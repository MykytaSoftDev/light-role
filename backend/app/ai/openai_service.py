from __future__ import annotations

import json
import logging
import time
from typing import Any

from openai import AsyncOpenAI

from app.ai.interface import AIServiceInterface, AIUsageInfo, ParsedJobData, ParseJobResult
from app.config import settings

logger = logging.getLogger(__name__)

_MODEL = "gpt-4o-mini"
_TIMEOUT = 30.0  # seconds

_SYSTEM_PROMPT = """\
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


class OpenAIService(AIServiceInterface):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=_TIMEOUT,
        )

    async def parse_job_description(self, text: str) -> ParseJobResult:
        empty_data = ParsedJobData()

        try:
            start_ms = time.monotonic()

            response = await self._client.chat.completions.create(
                model=_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0,
            )

            elapsed_ms = int((time.monotonic() - start_ms) * 1000)

            raw_content = response.choices[0].message.content or ""
            parsed = self._parse_response(raw_content)

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

    def _parse_response(self, content: str) -> ParsedJobData:
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
