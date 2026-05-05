from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

from openai import AsyncOpenAI

from app.ai.interface import (
    AIServiceInterface,
    AIUsageInfo,
    CertificationItem,
    CoverLetterVariant,
    EducationItem,
    ExperienceItem,
    GenerateCoverLetterResult,
    ParsedJobData,
    ParseJobResult,
    ParseResumeProfileResult,
    PersonalInfo,
    ResumeAnalysisResult,
    ResumeData,
)
from app.config import settings

logger = logging.getLogger(__name__)

_MODEL = "gpt-4o-mini"
_TIMEOUT = 30.0        # seconds — for simple calls (job parsing)
_ANALYZE_TIMEOUT = 120.0  # seconds — for the heavy combined resume analysis call
_PROFILE_PARSE_TIMEOUT = 60.0  # seconds — for resume → ProfileData parsing (PROFILE-2)

# Hosts whose profile URLs always require a path component. A bare root URL
# like "https://www.linkedin.com" with no /in/<username> is not a profile and
# must be rejected from the parsed social_links.
_PLATFORM_ROOT_HOSTS: frozenset[str] = frozenset({
    "linkedin.com",
    "www.linkedin.com",
    "github.com",
    "www.github.com",
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "facebook.com",
    "www.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "youtube.com",
    "www.youtube.com",
    "dribbble.com",
    "www.dribbble.com",
    "behance.net",
    "www.behance.net",
})

_JOB_PARSE_SYSTEM_PROMPT = """\
You are an expert recruiter and job description analyst. Your task is to extract structured information from job descriptions provided by the user.

The job description may be in any format: formal corporate postings, informal startup descriptions, LinkedIn posts, emails, bullet-point lists, or paragraphs. It may be written in any language.

Extract the following fields:
- job_title: The title of the position (e.g. "Senior Backend Engineer"). If unclear, make your best inference. If truly absent, return null.
- company: The name of the hiring company or organisation. If the posting is confidential or uses a recruiting agency without naming the client, return null.
- requirements: A flat list of individual skills, qualifications, tools, or experience requirements. Each item must be a concise string (e.g. "Python", "5+ years backend experience", "Bachelor's degree in Computer Science"). Extract all meaningful requirements. Return an empty list if none are found.
- location: City, country, "Remote", "Hybrid", or a combination (e.g. "Berlin, Germany (Hybrid)"). Return null if not mentioned.
- salary: The compensation as stated, including currency and period if present (e.g. "$90,000–$120,000/year", "€60k", "£400/day"). Return null if not mentioned.

Rules:
- Never hallucinate or invent information that is not present in the text.
- If a field cannot be confidently determined from the text, return null (or [] for requirements).
- Return ONLY valid JSON with exactly these five keys: job_title, company, requirements, location, salary.
- Do not include any explanation, markdown, or extra text outside the JSON object.

Example output:
{
  "job_title": "Backend Engineer",
  "company": "Acme Corp",
  "requirements": ["Python", "FastAPI", "PostgreSQL", "3+ years experience"],
  "location": "Remote",
  "salary": "$80,000–$100,000/year"
}
"""

_RESUME_ANALYZE_SYSTEM_PROMPT = """\
You are an expert resume coach and ATS optimization specialist. You will be given a resume (as plain text) and a job description. Perform all four tasks below in a single pass and return the result as valid JSON.

Tasks:
1. PARSE the resume into structured data.
2. SCORE the match between the resume and the job description on a scale of 1-100.
3. IDENTIFY keyword gaps (important terms from the job description missing from the resume) and write actionable recommendations.
4. GENERATE an optimized version of the resume that improves the match score while remaining truthful.

Return a JSON object with exactly these top-level keys:

{
  "parsed_data": {
    "personal_info": {
      "name": string | null,
      "email": string | null,
      "phone": string | null,
      "location": string | null,
      "linkedin": string | null,
      "website": string | null,
      "summary": string | null
    },
    "summary": string | null,
    "experience": [
      {
        "company": string,
        "title": string,
        "start_date": string | null,
        "end_date": string | null,
        "current": boolean,
        "description": string,
        "achievements": [string]
      }
    ],
    "education": [
      {
        "institution": string,
        "degree": string,
        "field": string | null,
        "start_date": string | null,
        "end_date": string | null,
        "gpa": string | null
      }
    ],
    "skills": [string],
    "languages": [string],
    "certifications": [
      {
        "name": string,
        "issuer": string | null,
        "date": string | null
      }
    ]
  },
  "match_score": integer (1-100),
  "keyword_gaps": [string],
  "recommendations": [string],
  "optimized_data": { /* same structure as parsed_data */ }
}

Experience parsing rules (apply to both parsed_data and optimized_data):
- "description": One sentence only — a brief high-level summary of what the person did in the role overall. If no clear single-sentence summary exists in the source text, set to "" (empty string).
- "achievements": Array of individual accomplishments, one per array item. Split on bullet points (•, -, *, etc.), line breaks, or sentence boundaries. Each item is one standalone sentence/bullet. Preserve the original wording exactly in parsed_data; in optimized_data you may rephrase to match job keywords but keep each as a separate array item.
- If the source text is entirely a list of accomplishments with no separate summary sentence, set description="" and put ALL sentences/bullets into achievements.
- NEVER leave achievements as [] when the experience entry contains any descriptive or accomplishment text.

Experience example (correct):
{
  "company": "Acme Corp",
  "title": "Software Engineer",
  "start_date": "Jan 2022",
  "end_date": null,
  "current": true,
  "description": "Designed and maintained backend services using NestJS and TypeScript.",
  "achievements": [
    "Optimized API performance, reducing response times by 30% across multiple projects",
    "Built and customized CMS plugins (WordPress, Shopify), increasing user engagement by 40%",
    "Integrated payment gateways (Stripe, Paddle), reducing transaction failures"
  ]
}

Rules:
- Never invent experience, education, or credentials not present in the original resume.
- For optimized_data you may: rephrase bullet points to better match job keywords, reorder achievements for impact, add or expand a professional summary, incorporate job-relevant keywords naturally.
- match_score must be an integer from 1 to 100 reflecting how well the original resume matches the job description.
- keyword_gaps should list terms that appear in the job description but are absent or weak in the resume.
- recommendations should be specific, actionable strings (e.g. "Add 'TypeScript' to your skills section").
- Return ONLY valid JSON — no markdown fences, no extra text.
"""


_PROFILE_PARSE_SYSTEM_PROMPT = """\
You are an expert resume parser. Extract a complete, structured user profile from the resume text provided by the user.

The resume may be in any format and any language. Read it carefully and map every piece of information to the correct section of the profile schema below.

Return ONLY a valid JSON object with EXACTLY these top-level keys (no extras, no missing keys):

{
  "personal_info": {
    "full_name": string,
    "email": string,
    "phone": string,
    "location": string | null,
    "social_links": [
      {"platform": string, "url": string}
    ]
  },
  "summary": string,
  "employment": [
    {
      "role": string,
      "company": string,
      "location": string | null,
      "start_date": string,
      "end_date": string | null,
      "is_current": boolean,
      "details": [string]
    }
  ],
  "education": [
    {
      "degree": string,
      "institution": string,
      "field_of_study": string | null,
      "location": string | null,
      "start_date": string,
      "end_date": string | null,
      "is_current": boolean,
      "description": string | null
    }
  ],
  "skills": [
    {"name": string}
  ],
  "projects": [
    {
      "name": string,
      "description": string,
      "role": string | null,
      "start_date": string | null,
      "end_date": string | null,
      "is_current": boolean,
      "technologies": [string],
      "url": string | null,
      "repository_url": string | null,
      "details": [string]
    }
  ],
  "languages": [
    {"name": string}
  ],
  "certificates": [
    {
      "name": string,
      "issuer": string | null,
      "issue_date": string | null,
      "expiry_date": string | null,
      "credential_url": string | null
    }
  ],
  "achievements": [
    {
      "title": string,
      "description": string | null,
      "date": string | null,
      "issuer": string | null
    }
  ],
  "volunteer": [
    {
      "role": string,
      "organization": string,
      "location": string | null,
      "start_date": string,
      "end_date": string | null,
      "is_current": boolean,
      "details": [string]
    }
  ]
}

CRITICAL RULES:

1. NEVER invent or hallucinate jobs, education, skills, projects, certifications, achievements, languages, or any other data not literally present in the resume text. If a section is missing from the resume, return an empty array for it.

2. Do NOT generate or include any `id` field on any item — IDs are assigned by the frontend.

3. Date format: Use "YYYY-MM" (year-month) for all date fields (start_date, end_date, issue_date, expiry_date, date). If only a year is given, use "YYYY-01" for start dates and "YYYY-12" for end dates. If a date is genuinely missing, use null (or empty string only where the schema requires a string — see rules 6 and 8).

4. Current positions: If a role/study/project says "Present", "Current", "Now", "to date" or has no end date listed for an ongoing item, set is_current=true AND end_date=null.

5. employment.details and volunteer.details and project.details: Each is an array of bullet-point strings. Split the source on bullet markers (•, -, *, ▪) or line breaks. Keep each bullet as one separate string. Preserve original wording. If only a paragraph is given (no bullets), put it as a single-element array.

6. personal_info.email: REQUIRED string. If the resume contains no email, use empty string "" (NOT null). The user can fix this after upload.

7. personal_info.phone: REQUIRED string. If missing, use empty string "" (NOT null).

8. personal_info.full_name: REQUIRED string. Use the candidate's name as it appears in the resume (typically the heading). If genuinely absent, use empty string "".

9. employment[].start_date and education[].start_date and volunteer[].start_date are REQUIRED strings. If the resume omits a start date for an entry, use empty string "" — do NOT invent dates.

10. summary: A plain-text string. Extract any "Profile", "Summary", "Professional Summary", "About Me", or "Objective" section. If none exists, use empty string "".

11. social_links: Extract any LinkedIn, GitHub, personal website, X (Twitter), portfolio, blog, or other social URLs found anywhere in the resume. For the `platform` field, use one of these whitelisted values that best fits: "LinkedIn", "GitHub", "X", "Portfolio", "Website", "Blog", "Facebook", "Instagram", "YouTube", "Dribbble", "Behance", "Custom". Use "Custom" if no other option matches. The `url` field MUST be a real, complete URL extracted from the resume — typically containing "://" or a domain like "linkedin.com/in/xyz" or "github.com/xyz". If the resume only mentions a platform name (e.g. just the word "LinkedIn" or a logo) WITHOUT an accompanying URL or username, OMIT that social_link entry entirely. NEVER use the platform name as the URL value, and NEVER invent or guess URLs. If you only have a username (e.g. "@johndoe" on GitHub), construct the canonical URL ("https://github.com/johndoe"). If you have a bare domain ("portfolio.dev"), prepend "https://". The user message may include a section labeled "[DETECTED_URLS]" near the end — these are URLs extracted from the document's hyperlink annotations (often hidden under icons or short visible text like "LinkedIn"). Use these URLs to populate `social_links` whenever you can correlate a URL to its platform by domain (linkedin.com → LinkedIn, github.com → GitHub, twitter.com or x.com → X, etc.). Prefer FULL profile URLs from [DETECTED_URLS] over short visible text. NEVER output a bare root-domain URL like "https://linkedin.com" or "https://www.github.com" — those have no profile path and are useless. If the resume gives you only a root domain with no username/path, OMIT the social_link entry entirely.

12. skills: Each is just `{"name": "<skill>"}` — do NOT include category or level. Split comma-separated or pipe-separated skill lists into individual items.

13. languages: Each is just `{"name": "<language>"}` — extract the language name only (e.g. "English", "German"). Do NOT include proficiency levels in the name field.

14. projects: Include personal projects, open-source contributions, side projects, hackathon projects. `description` is a one-paragraph summary; `details` is the array of bullet points (achievements/features). If the source only has bullets, put them in `details` and use the first bullet (or a brief synthesis) as `description`.

15. achievements: Include awards, hackathon wins, published works, recognitions, scholarships. NOT job-related accomplishments — those go into employment[].details.

16. certificates: Include only items the resume labels as certifications, certificates, or licenses (e.g. "AWS Certified Solutions Architect"). Do NOT promote skills or courses to certificates.

17. Output ONLY valid JSON — no markdown fences, no commentary, no preamble, no trailing text.
"""


_COVER_LETTER_SYSTEM_PROMPT = """\
You are an expert career coach and professional writer specialising in cover letters. You will be given a job description, a resume, style/tone/length preferences, and optional additional context from the applicant.

Your task is to generate exactly 3 cover letter variants. Each variant must:
- Address the specific job and company from the job description
- Draw only on experience, skills, and achievements present in the resume — never hallucinate credentials
- Reflect the requested STYLE:
    - formal: traditional business language, formal salutations, conservative structure
    - professional: polished and modern, confident but not stiff, suits most corporate environments
    - job_matched: analyse the tone of the job posting and mirror it (e.g. casual startup → conversational; finance firm → formal)
- Reflect the requested TONE:
    - confident: assertive and self-assured, highlights achievements with authority
    - humble: modest and appreciative, emphasises eagerness to learn and contribute
    - enthusiastic: energetic and excited about the role, conveys genuine passion
- Respect the requested LENGTH:
    - short: 200–300 words
    - medium: 300–400 words
    - long: 400–500 words
- Take a distinctly different approach or angle from the other variants (e.g. opening hook, emphasis on different skills, different structure) while covering the same key qualifications
- Incorporate the applicant's additional_context if provided (e.g. relocation plans, specific motivation, preferred start date)

Return ONLY a valid JSON object with this exact structure — no markdown fences, no extra text:
{
  "variants": [
    {"content": "<full cover letter text>", "label": "Variant 1"},
    {"content": "<full cover letter text>", "label": "Variant 2"},
    {"content": "<full cover letter text>", "label": "Variant 3"}
  ]
}
"""


class OpenAIService(AIServiceInterface):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=_TIMEOUT,
            max_retries=0,  # we handle retries/errors ourselves
        )

    async def parse_job_description(self, text: str) -> ParseJobResult:
        empty_data = ParsedJobData()

        try:
            start_ms = time.monotonic()

            response = await self._client.chat.completions.create(
                model=_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _JOB_PARSE_SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0,
            )

            elapsed_ms = int((time.monotonic() - start_ms) * 1000)

            raw_content = response.choices[0].message.content or ""
            parsed = self._parse_job_response(raw_content)

            usage_info = AIUsageInfo(
                model=response.model,
                tokens_input=response.usage.prompt_tokens if response.usage else 0,
                tokens_output=response.usage.completion_tokens if response.usage else 0,
                response_time_ms=elapsed_ms,
            )

            return ParseJobResult(data=parsed, usage=usage_info, success=True)

        except Exception as exc:
            logger.warning("OpenAI parse_job_description failed: %s", exc)
            return ParseJobResult(data=empty_data, usage=None, success=False)

    async def analyze_resume(
        self, resume_text: str, job_description: str
    ) -> ResumeAnalysisResult:
        empty_resume = ResumeData()
        empty_result = ResumeAnalysisResult(
            parsed_data=empty_resume,
            match_score=0,
            keyword_gaps=[],
            recommendations=[],
            optimized_data=empty_resume,
            usage=None,
            success=False,
        )

        try:
            user_content = (
                f"=== RESUME ===\n{resume_text}\n\n"
                f"=== JOB DESCRIPTION ===\n{job_description}"
            )

            start_ms = time.monotonic()

            response = await self._client.chat.completions.create(
                model=_MODEL,
                response_format={"type": "json_object"},
                timeout=_ANALYZE_TIMEOUT,
                messages=[
                    {"role": "system", "content": _RESUME_ANALYZE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
            )

            elapsed_ms = int((time.monotonic() - start_ms) * 1000)

            raw_content = response.choices[0].message.content or ""
            analysis = self._parse_resume_analysis_response(raw_content)

            usage_info = AIUsageInfo(
                model=response.model,
                tokens_input=response.usage.prompt_tokens if response.usage else 0,
                tokens_output=response.usage.completion_tokens if response.usage else 0,
                response_time_ms=elapsed_ms,
            )

            logger.info(
                "Resume analysis complete: score=%d tokens_in=%d tokens_out=%d elapsed_ms=%d",
                analysis["match_score"],
                usage_info.tokens_input,
                usage_info.tokens_output,
                elapsed_ms,
            )

            return ResumeAnalysisResult(
                parsed_data=analysis["parsed_data"],
                match_score=analysis["match_score"],
                keyword_gaps=analysis["keyword_gaps"],
                recommendations=analysis["recommendations"],
                optimized_data=analysis["optimized_data"],
                usage=usage_info,
                success=True,
            )

        except Exception as exc:
            logger.warning("OpenAI analyze_resume failed: %s", exc)
            return ResumeAnalysisResult(
                parsed_data=empty_resume,
                match_score=0,
                keyword_gaps=[],
                recommendations=[],
                optimized_data=empty_resume,
                usage=None,
                success=False,
            )

    async def generate_cover_letter(
        self,
        job_description: str,
        resume_text: str,
        style: str,
        tone: str,
        length: str,
        additional_context: str = "",
    ) -> GenerateCoverLetterResult:
        empty_result = GenerateCoverLetterResult(variants=[], usage=None, success=False)

        try:
            user_content_parts = [
                f"=== JOB DESCRIPTION ===\n{job_description}",
                f"\n=== RESUME ===\n{resume_text}",
                f"\n=== PREFERENCES ===\nStyle: {style}\nTone: {tone}\nLength: {length}",
            ]
            if additional_context.strip():
                user_content_parts.append(
                    f"\n=== ADDITIONAL CONTEXT FROM APPLICANT ===\n{additional_context}"
                )
            user_content = "\n".join(user_content_parts)

            start_ms = time.monotonic()

            response = await self._client.chat.completions.create(
                model=_MODEL,
                response_format={"type": "json_object"},
                timeout=_ANALYZE_TIMEOUT,
                messages=[
                    {"role": "system", "content": _COVER_LETTER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.7,
            )

            elapsed_ms = int((time.monotonic() - start_ms) * 1000)

            raw_content = response.choices[0].message.content or ""
            variants = self._parse_cover_letter_response(raw_content)

            if not variants:
                logger.warning("OpenAI generate_cover_letter returned no variants")
                return empty_result

            usage_info = AIUsageInfo(
                model=response.model,
                tokens_input=response.usage.prompt_tokens if response.usage else 0,
                tokens_output=response.usage.completion_tokens if response.usage else 0,
                response_time_ms=elapsed_ms,
            )

            logger.info(
                "Cover letter generation complete: variants=%d tokens_in=%d tokens_out=%d elapsed_ms=%d",
                len(variants),
                usage_info.tokens_input,
                usage_info.tokens_output,
                elapsed_ms,
            )

            return GenerateCoverLetterResult(variants=variants, usage=usage_info, success=True)

        except Exception as exc:
            logger.warning("OpenAI generate_cover_letter failed: %s", exc)
            return empty_result

    async def parse_resume_to_profile(
        self,
        file_bytes: bytes,
        file_format: str,
    ) -> ParseResumeProfileResult:
        """Extract a v2.1 ProfileData JSONB structure from an uploaded resume.

        File bytes are processed entirely in-memory (BytesIO) — no temp files
        are written to disk (PRD 3.3.16).

        Raises:
            ValueError: Unsupported format, corrupted file, or text too short
                to be a real resume. The router maps this to HTTP 422.
            Exception: OpenAI/network/validation failures are re-raised
                untouched so the router can map them to HTTP 502.
        """
        # Step A: Extract text in-memory. ValueError here means bad input → 422.
        try:
            text = self._extract_resume_text(file_bytes, file_format)
        except ValueError:
            raise
        except Exception as exc:
            # pdfplumber / python-docx parse failure → corrupted file → 422
            logger.warning("Resume text extraction failed: %s", exc)
            raise ValueError(f"Could not read {file_format} file: {exc}") from exc

        if not text or len(text.strip()) < 50:
            raise ValueError("File contains no extractable text or is too short")

        # Step B: Call OpenAI with structured output. Exceptions re-raised → 502.
        start_ms = time.monotonic()

        response = await self._client.chat.completions.create(
            model=settings.ai_model_parse_resume,
            response_format={"type": "json_object"},
            timeout=_PROFILE_PARSE_TIMEOUT,
            messages=[
                {"role": "system", "content": _PROFILE_PARSE_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0,
        )

        elapsed_ms = int((time.monotonic() - start_ms) * 1000)

        raw_content = response.choices[0].message.content or ""
        profile_dict = self._parse_profile_response(raw_content)

        # Validate against ProfileData (raises pydantic.ValidationError on schema
        # mismatch). Imported lazily so the AI module stays import-light.
        from app.schemas.profile import ProfileData

        validated = ProfileData.model_validate(profile_dict)
        validated_dict = validated.model_dump(mode="json")

        usage_info = AIUsageInfo(
            model=response.model,
            tokens_input=response.usage.prompt_tokens if response.usage else 0,
            tokens_output=response.usage.completion_tokens if response.usage else 0,
            response_time_ms=elapsed_ms,
        )

        logger.info(
            "Resume → ProfileData parse complete: tokens_in=%d tokens_out=%d elapsed_ms=%d",
            usage_info.tokens_input,
            usage_info.tokens_output,
            elapsed_ms,
        )

        return ParseResumeProfileResult(
            profile_data=validated_dict,
            usage=usage_info,
            success=True,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _parse_job_response(self, content: str) -> ParsedJobData:
        """Parse JSON response from OpenAI into ParsedJobData. Returns empty data on any error."""
        try:
            raw: dict[str, Any] = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to decode OpenAI JSON response: %s", exc)
            return ParsedJobData()

        requirements_raw = raw.get("requirements")
        requirements: list[str] = []
        if isinstance(requirements_raw, list):
            requirements = [str(r) for r in requirements_raw if r]

        def _str_or_none(val: Any) -> str | None:
            if val is None or val == "":
                return None
            return str(val)

        return ParsedJobData(
            job_title=_str_or_none(raw.get("job_title")),
            company=_str_or_none(raw.get("company")),
            requirements=requirements,
            location=_str_or_none(raw.get("location")),
            salary=_str_or_none(raw.get("salary")),
        )

    def _parse_resume_analysis_response(self, content: str) -> dict[str, Any]:
        """Parse JSON response for resume analysis. Raises on any error."""
        raw: dict[str, Any] = json.loads(content)

        parsed_data = self._parse_resume_data(raw.get("parsed_data", {}))
        optimized_data = self._parse_resume_data(raw.get("optimized_data", {}))

        match_score_raw = raw.get("match_score", 0)
        try:
            match_score = max(1, min(100, int(match_score_raw)))
        except (TypeError, ValueError):
            match_score = 1

        keyword_gaps = [str(g) for g in raw.get("keyword_gaps", []) if g]
        recommendations = [str(r) for r in raw.get("recommendations", []) if r]

        return {
            "parsed_data": parsed_data,
            "match_score": match_score,
            "keyword_gaps": keyword_gaps,
            "recommendations": recommendations,
            "optimized_data": optimized_data,
        }

    def _parse_resume_data(self, raw: Any) -> ResumeData:
        """Convert a raw dict into a ResumeData dataclass, tolerating missing fields."""
        if not isinstance(raw, dict):
            return ResumeData()

        def _str_or_none(val: Any) -> str | None:
            if val is None or val == "":
                return None
            return str(val)

        # personal_info
        pi_raw = raw.get("personal_info", {}) or {}
        personal_info = PersonalInfo(
            name=_str_or_none(pi_raw.get("name")),
            email=_str_or_none(pi_raw.get("email")),
            phone=_str_or_none(pi_raw.get("phone")),
            location=_str_or_none(pi_raw.get("location")),
            linkedin=_str_or_none(pi_raw.get("linkedin")),
            website=_str_or_none(pi_raw.get("website")),
            summary=_str_or_none(pi_raw.get("summary")),
        )

        # experience
        experience: list[ExperienceItem] = []
        for exp in raw.get("experience", []) or []:
            if not isinstance(exp, dict):
                continue
            experience.append(
                ExperienceItem(
                    company=str(exp.get("company", "")),
                    title=str(exp.get("title", "")),
                    start_date=_str_or_none(exp.get("start_date")),
                    end_date=_str_or_none(exp.get("end_date")),
                    current=bool(exp.get("current", False)),
                    description=str(exp.get("description", "")),
                    achievements=[str(a) for a in exp.get("achievements", []) if a],
                )
            )

        # education
        education: list[EducationItem] = []
        for edu in raw.get("education", []) or []:
            if not isinstance(edu, dict):
                continue
            education.append(
                EducationItem(
                    institution=str(edu.get("institution", "")),
                    degree=str(edu.get("degree", "")),
                    field=_str_or_none(edu.get("field")),
                    start_date=_str_or_none(edu.get("start_date")),
                    end_date=_str_or_none(edu.get("end_date")),
                    gpa=_str_or_none(edu.get("gpa")),
                )
            )

        # certifications
        certifications: list[CertificationItem] = []
        for cert in raw.get("certifications", []) or []:
            if not isinstance(cert, dict):
                continue
            certifications.append(
                CertificationItem(
                    name=str(cert.get("name", "")),
                    issuer=_str_or_none(cert.get("issuer")),
                    date=_str_or_none(cert.get("date")),
                )
            )

        skills = [str(s) for s in raw.get("skills", []) if s]
        languages = [str(lang) for lang in raw.get("languages", []) if lang]

        return ResumeData(
            personal_info=personal_info,
            summary=_str_or_none(raw.get("summary")),
            experience=experience,
            education=education,
            skills=skills,
            languages=languages,
            certifications=certifications,
        )

    def _parse_cover_letter_response(self, content: str) -> list[CoverLetterVariant]:
        """Parse JSON response from OpenAI into a list of CoverLetterVariant. Returns [] on error."""
        try:
            raw: dict[str, Any] = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning("Failed to decode cover letter JSON response: %s", exc)
            return []

        variants_raw = raw.get("variants")
        if not isinstance(variants_raw, list):
            logger.warning("Cover letter response missing 'variants' list")
            return []

        variants: list[CoverLetterVariant] = []
        for i, item in enumerate(variants_raw):
            if not isinstance(item, dict):
                continue
            content_text = str(item.get("content", "")).strip()
            label = str(item.get("label", f"Variant {i + 1}")).strip()
            if content_text:
                variants.append(CoverLetterVariant(content=content_text, label=label))

        return variants

    # ------------------------------------------------------------------
    # Profile parsing helpers (PROFILE-2)
    # ------------------------------------------------------------------

    def _extract_resume_text(self, file_bytes: bytes, file_format: str) -> str:
        """Extract plain text from PDF or DOCX bytes. NO temp files written.

        Raises ValueError for unsupported formats. Lower-level library errors
        propagate (the caller wraps them into ValueError).
        """
        from io import BytesIO

        fmt = (file_format or "").lower().lstrip(".")

        if fmt == "pdf":
            import pdfplumber

            text_parts: list[str] = []
            detected_urls: list[str] = []
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    if page_text:
                        text_parts.append(page_text)
                    # Collect any hyperlink URIs embedded in the PDF.
                    try:
                        hyperlinks = page.hyperlinks or []
                        for link in hyperlinks:
                            uri = link.get("uri") if isinstance(link, dict) else None
                            if uri and isinstance(uri, str):
                                detected_urls.append(uri.strip())
                        if not hyperlinks:
                            # Fall back to annotations if hyperlinks list is empty.
                            for annot in (page.annots or []):
                                if not isinstance(annot, dict):
                                    continue
                                uri = annot.get("uri")
                                if not uri:
                                    data = annot.get("data") or {}
                                    if isinstance(data, dict):
                                        a = data.get("A") or {}
                                        if isinstance(a, dict):
                                            uri = a.get("URI")
                                if uri and isinstance(uri, (str, bytes)):
                                    if isinstance(uri, bytes):
                                        try:
                                            uri = uri.decode("utf-8", "ignore")
                                        except Exception:
                                            uri = ""
                                    if uri:
                                        detected_urls.append(uri.strip())
                    except Exception:
                        pass  # be defensive — never let hyperlink extraction break text extraction
            body = "\n\n".join(text_parts)
            if detected_urls:
                unique_urls = list(dict.fromkeys(detected_urls))  # dedupe, keep order
                body += "\n\n[DETECTED_URLS]\n" + "\n".join(unique_urls)
            return body

        if fmt == "docx":
            from docx import Document

            doc = Document(BytesIO(file_bytes))
            text_parts: list[str] = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        cell_text = cell.text.strip()
                        if cell_text:
                            text_parts.append(cell_text)
            # Collect hyperlink URIs from the DOCX relationships.
            detected_urls: list[str] = []
            try:
                for rel in doc.part.rels.values():
                    reltype = getattr(rel, "reltype", "") or ""
                    if "hyperlink" in reltype.lower():
                        target = getattr(rel, "target_ref", "") or ""
                        if target and isinstance(target, str):
                            detected_urls.append(target.strip())
            except Exception:
                pass  # be defensive — never let hyperlink extraction break text extraction
            body = "\n".join(text_parts)
            if detected_urls:
                unique_urls = list(dict.fromkeys(detected_urls))
                body += "\n\n[DETECTED_URLS]\n" + "\n".join(unique_urls)
            return body

        raise ValueError(f"Unsupported file format: {file_format!r} (expected 'pdf' or 'docx')")

    def _parse_profile_response(self, content: str) -> dict[str, Any]:
        """Parse the OpenAI JSON response into a ProfileData-shaped dict.

        Tolerates type oddities (defensive coercion). Strips entries that have
        no meaningful content. Raises ValueError on JSON decode failure so the
        caller can surface a clean error.
        """
        try:
            raw: dict[str, Any] = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError(f"AI returned invalid JSON: {exc}") from exc

        if not isinstance(raw, dict):
            raise ValueError("AI response was not a JSON object")

        return {
            "personal_info": self._coerce_personal_info(raw.get("personal_info")),
            "summary": _str_default(raw.get("summary"), ""),
            "employment": self._coerce_employment_list(raw.get("employment")),
            "education": self._coerce_education_list(raw.get("education")),
            "skills": self._coerce_named_list(raw.get("skills")),
            "projects": self._coerce_project_list(raw.get("projects")),
            "languages": self._coerce_named_list(raw.get("languages")),
            "certificates": self._coerce_certificate_list(raw.get("certificates")),
            "achievements": self._coerce_achievement_list(raw.get("achievements")),
            "volunteer": self._coerce_volunteer_list(raw.get("volunteer")),
        }

    def _coerce_personal_info(self, raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raw = {}
        social_links_raw = raw.get("social_links") or []
        social_links: list[dict[str, str]] = []
        if isinstance(social_links_raw, list):
            for item in social_links_raw:
                if not isinstance(item, dict):
                    continue
                platform = _str_default(item.get("platform"), "").strip()
                url = _str_default(item.get("url"), "").strip()
                if not platform or not url:
                    continue
                # Reject pseudo-URLs the model occasionally emits (e.g. url == platform name)
                if url.casefold() == platform.casefold():
                    continue
                if len(url) < 5:
                    continue
                if "." not in url and "://" not in url:
                    continue
                # Reject bare root-domain URLs for platforms that require a profile path.
                # e.g. "https://www.linkedin.com" with no /in/<username> is not a profile.
                _normalised = url.lower().split("://", 1)[-1]  # strip scheme
                _normalised = _normalised.rstrip("/")
                if _normalised in _PLATFORM_ROOT_HOSTS:
                    continue
                social_links.append({"platform": platform, "url": url})
        return {
            "full_name": _str_default(raw.get("full_name"), ""),
            "email": _str_default(raw.get("email"), ""),
            "phone": _str_default(raw.get("phone"), ""),
            "location": _nullable_str(raw.get("location")),
            "social_links": social_links,
        }

    def _coerce_employment_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            role = _str_default(item.get("role"), "").strip()
            company = _str_default(item.get("company"), "").strip()
            if not role and not company:
                # Skip empty entries.
                continue
            items.append({
                "role": role,
                "company": company,
                "location": _nullable_str(item.get("location")),
                "start_date": _str_default(item.get("start_date"), ""),
                "end_date": _nullable_str(item.get("end_date")),
                "is_current": bool(item.get("is_current", False)),
                "details": _coerce_str_list(item.get("details")),
            })
        return items

    def _coerce_education_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            degree = _str_default(item.get("degree"), "").strip()
            institution = _str_default(item.get("institution"), "").strip()
            if not degree and not institution:
                continue
            items.append({
                "degree": degree,
                "institution": institution,
                "field_of_study": _nullable_str(item.get("field_of_study")),
                "location": _nullable_str(item.get("location")),
                "start_date": _str_default(item.get("start_date"), ""),
                "end_date": _nullable_str(item.get("end_date")),
                "is_current": bool(item.get("is_current", False)),
                "description": _nullable_str(item.get("description")),
            })
        return items

    def _coerce_named_list(self, raw: Any) -> list[dict[str, str]]:
        """For skills/languages — each item is just {'name': ...}."""
        items: list[dict[str, str]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            name: str = ""
            if isinstance(item, dict):
                name = _str_default(item.get("name"), "").strip()
            elif isinstance(item, str):
                name = item.strip()
            if name:
                items.append({"name": name})
        return items

    def _coerce_project_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            name = _str_default(item.get("name"), "").strip()
            description = _str_default(item.get("description"), "").strip()
            if not name and not description:
                continue
            items.append({
                "name": name,
                "description": description,
                "role": _nullable_str(item.get("role")),
                "start_date": _nullable_str(item.get("start_date")),
                "end_date": _nullable_str(item.get("end_date")),
                "is_current": bool(item.get("is_current", False)),
                "technologies": _coerce_str_list(item.get("technologies")),
                "url": _nullable_str(item.get("url")),
                "repository_url": _nullable_str(item.get("repository_url")),
                "details": _coerce_str_list(item.get("details")),
            })
        return items

    def _coerce_certificate_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            name = _str_default(item.get("name"), "").strip()
            if not name:
                continue
            items.append({
                "name": name,
                "issuer": _nullable_str(item.get("issuer")),
                "issue_date": _nullable_str(item.get("issue_date")),
                "expiry_date": _nullable_str(item.get("expiry_date")),
                "credential_url": _nullable_str(item.get("credential_url")),
            })
        return items

    def _coerce_achievement_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            title = _str_default(item.get("title"), "").strip()
            if not title:
                continue
            items.append({
                "title": title,
                "description": _nullable_str(item.get("description")),
                "date": _nullable_str(item.get("date")),
                "issuer": _nullable_str(item.get("issuer")),
            })
        return items

    def _coerce_volunteer_list(self, raw: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if not isinstance(raw, list):
            return items
        for item in raw:
            if not isinstance(item, dict):
                continue
            role = _str_default(item.get("role"), "").strip()
            organization = _str_default(item.get("organization"), "").strip()
            if not role and not organization:
                continue
            items.append({
                "role": role,
                "organization": organization,
                "location": _nullable_str(item.get("location")),
                "start_date": _str_default(item.get("start_date"), ""),
                "end_date": _nullable_str(item.get("end_date")),
                "is_current": bool(item.get("is_current", False)),
                "details": _coerce_str_list(item.get("details")),
            })
        return items


# ---------------------------------------------------------------------------
# Module-level coercion helpers (used by profile parsing)
# ---------------------------------------------------------------------------

def _str_default(val: Any, default: str) -> str:
    if val is None:
        return default
    if isinstance(val, str):
        return val
    return str(val)


def _nullable_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, str):
        s = val.strip()
        return s if s else None
    return str(val)


def _coerce_str_list(val: Any) -> list[str]:
    if not isinstance(val, list):
        return []
    out: list[str] = []
    for item in val:
        if item is None:
            continue
        s = item if isinstance(item, str) else str(item)
        s = s.strip()
        if s:
            out.append(s)
    return out
