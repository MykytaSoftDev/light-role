from __future__ import annotations

import json
import logging
import time
from typing import Any

from openai import AsyncOpenAI

from app.ai.interface import (
    AIServiceInterface,
    AIUsageInfo,
    CertificationItem,
    EducationItem,
    ExperienceItem,
    ParsedJobData,
    ParseJobResult,
    PersonalInfo,
    ResumeAnalysisResult,
    ResumeData,
)
from app.config import settings

logger = logging.getLogger(__name__)

_MODEL = "gpt-4o-mini"
_TIMEOUT = 30.0        # seconds — for simple calls (job parsing)
_ANALYZE_TIMEOUT = 120.0  # seconds — for the heavy combined resume analysis call

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

Rules:
- Never invent experience, education, or credentials not present in the original resume.
- For optimized_data you may: rephrase bullet points to better match job keywords, reorder achievements for impact, add or expand a professional summary, incorporate job-relevant keywords naturally.
- match_score must be an integer from 1 to 100 reflecting how well the original resume matches the job description.
- keyword_gaps should list terms that appear in the job description but are absent or weak in the resume.
- recommendations should be specific, actionable strings (e.g. "Add 'TypeScript' to your skills section").
- Return ONLY valid JSON — no markdown fences, no extra text.
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
