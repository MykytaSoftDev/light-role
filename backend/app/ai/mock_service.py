from __future__ import annotations

from app.ai.interface import (
    AIServiceInterface,
    AIUsageInfo,
    CoverLetterVariant,
    GenerateCoverLetterResult,
    ParsedJobData,
    ParseJobResult,
    ParseResumeProfileResult,
    ResumeAnalysisResult,
    ResumeData,
)


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

    async def analyze_resume(
        self, resume_text: str, job_description: str
    ) -> ResumeAnalysisResult:
        empty = ResumeData()
        usage = AIUsageInfo(
            model="mock",
            tokens_input=200,
            tokens_output=100,
            response_time_ms=10,
        )
        return ResumeAnalysisResult(
            parsed_data=empty,
            match_score=75,
            keyword_gaps=["Docker", "Kubernetes"],
            recommendations=["Add Docker experience to skills section."],
            optimized_data=empty,
            usage=usage,
            success=True,
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
        usage = AIUsageInfo(
            model="mock",
            tokens_input=150,
            tokens_output=300,
            response_time_ms=10,
        )
        variants = [
            CoverLetterVariant(
                content=(
                    "Dear Hiring Manager,\n\n"
                    "I am excited to apply for this position. My background in software "
                    "engineering makes me a strong candidate. I look forward to contributing "
                    "to your team.\n\n"
                    "Best regards"
                ),
                label="Variant 1",
            ),
            CoverLetterVariant(
                content=(
                    "Dear Hiring Team,\n\n"
                    "Having reviewed the job description with great interest, I am confident "
                    "that my skills and experience align well with your requirements. "
                    "I would welcome the opportunity to discuss how I can add value.\n\n"
                    "Kind regards"
                ),
                label="Variant 2",
            ),
        ]
        return GenerateCoverLetterResult(variants=variants, usage=usage, success=True)

    async def parse_resume_to_profile(
        self,
        file_bytes: bytes,
        file_format: str,
    ) -> ParseResumeProfileResult:
        # Predictable, schema-valid mock for tests / dev without an OpenAI key.
        profile_data: dict = {
            "personal_info": {
                "full_name": "Jane Doe",
                "email": "jane.doe@example.com",
                "phone": "+1-555-0100",
                "location": "Berlin, Germany",
                "social_links": [
                    {"platform": "LinkedIn", "url": "https://linkedin.com/in/janedoe"},
                    {"platform": "GitHub", "url": "https://github.com/janedoe"},
                ],
            },
            "summary": "Senior software engineer with 8 years of backend experience.",
            "employment": [
                {
                    "role": "Senior Backend Engineer",
                    "company": "Acme Corp",
                    "location": "Berlin, Germany",
                    "start_date": "2022-01",
                    "end_date": None,
                    "is_current": True,
                    "details": [
                        "Designed and shipped a payment platform processing $10M/month.",
                        "Mentored 3 junior engineers.",
                    ],
                },
            ],
            "education": [
                {
                    "degree": "B.Sc. Computer Science",
                    "institution": "TU Berlin",
                    "field_of_study": "Computer Science",
                    "location": "Berlin, Germany",
                    "start_date": "2014-09",
                    "end_date": "2018-07",
                    "is_current": False,
                    "description": None,
                },
            ],
            "skills": [{"name": "Python"}, {"name": "FastAPI"}, {"name": "PostgreSQL"}],
            "projects": [],
            "languages": [{"name": "English"}, {"name": "German"}],
            "certificates": [],
            "achievements": [],
            "volunteer": [],
        }
        return ParseResumeProfileResult(
            profile_data=profile_data,
            usage=None,
            success=True,
        )
