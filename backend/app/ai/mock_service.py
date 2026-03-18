from __future__ import annotations

from app.ai.interface import AIServiceInterface, AIUsageInfo, ParsedJobData, ParseJobResult


class MockAIService(AIServiceInterface):
    """Predictable mock implementation used in unit tests."""

    async def parse_job_description(self, text: str) -> ParseJobResult:
        data = ParsedJobData(
            job_title="Software Engineer",
            company="Test Company",
            requirements=["Python", "FastAPI", "PostgreSQL"],
            location="Remote",
            salary="$80,000–$100,000/year",
        )
        usage = AIUsageInfo(
            model="mock",
            tokens_input=100,
            tokens_output=50,
            response_time_ms=10,
        )
        return ParseJobResult(data=data, usage=usage, success=True)
