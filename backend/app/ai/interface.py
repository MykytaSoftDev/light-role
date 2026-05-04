from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ParsedJobData:
    job_title: Optional[str] = None
    company: Optional[str] = None
    requirements: list[str] = field(default_factory=list)
    location: Optional[str] = None
    salary: Optional[str] = None


@dataclass
class AIUsageInfo:
    model: str
    tokens_input: int
    tokens_output: int
    response_time_ms: int


@dataclass
class ParseJobResult:
    data: ParsedJobData
    usage: Optional[AIUsageInfo]  # None if parsing failed gracefully
    success: bool


# ---------------------------------------------------------------------------
# Resume analysis dataclasses
# ---------------------------------------------------------------------------

@dataclass
class PersonalInfo:
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    summary: Optional[str] = None


@dataclass
class ExperienceItem:
    company: str = ""
    title: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current: bool = False
    description: str = ""
    achievements: list[str] = field(default_factory=list)


@dataclass
class EducationItem:
    institution: str = ""
    degree: str = ""
    field: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None


@dataclass
class CertificationItem:
    name: str = ""
    issuer: Optional[str] = None
    date: Optional[str] = None


@dataclass
class ResumeData:
    personal_info: PersonalInfo = field(default_factory=PersonalInfo)
    summary: Optional[str] = None
    experience: list[ExperienceItem] = field(default_factory=list)
    education: list[EducationItem] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    certifications: list[CertificationItem] = field(default_factory=list)


@dataclass
class ResumeAnalysisResult:
    parsed_data: ResumeData
    match_score: int  # 1-100
    keyword_gaps: list[str]
    recommendations: list[str]  # actionable improvement suggestions
    optimized_data: ResumeData  # AI-optimized version
    usage: Optional[AIUsageInfo]
    success: bool


# ---------------------------------------------------------------------------
# Cover letter generation dataclasses
# ---------------------------------------------------------------------------

@dataclass
class CoverLetterVariant:
    content: str
    label: str  # e.g. "Variant 1", "Variant 2"


@dataclass
class GenerateCoverLetterResult:
    variants: list[CoverLetterVariant]  # 2-3 variants
    usage: Optional[AIUsageInfo]
    success: bool


# ---------------------------------------------------------------------------
# Profile parsing dataclass (PROFILE-2)
# ---------------------------------------------------------------------------

@dataclass
class ParseResumeProfileResult:
    """Result of parsing a resume file into the v2.1 ProfileData JSONB shape.

    `profile_data` is a JSON-serialisable dict that conforms to
    `app.schemas.profile.ProfileData`. The router/service layer is expected to
    call `ProfileData.model_validate(...)` if it needs the typed model.
    """
    profile_data: dict
    usage: Optional[AIUsageInfo]
    success: bool


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class AIServiceInterface(ABC):
    @abstractmethod
    async def parse_job_description(self, text: str) -> ParseJobResult:
        ...

    @abstractmethod
    async def analyze_resume(
        self, resume_text: str, job_description: str
    ) -> ResumeAnalysisResult:
        ...

    @abstractmethod
    async def generate_cover_letter(
        self,
        job_description: str,
        resume_text: str,
        style: str,
        tone: str,
        length: str,
        additional_context: str = "",
    ) -> GenerateCoverLetterResult:
        ...

    @abstractmethod
    async def parse_resume_to_profile(
        self,
        file_bytes: bytes,
        file_format: str,
    ) -> "ParseResumeProfileResult":
        """Extract a v2.1 ProfileData JSONB structure from an uploaded resume.

        Args:
            file_bytes: Raw PDF or DOCX file bytes (held in memory only).
            file_format: "pdf" or "docx" (case-insensitive, leading dot tolerated).

        Returns:
            ParseResumeProfileResult with `profile_data` matching
            `app.schemas.profile.ProfileData` (validated dict).

        Raises:
            ValueError: If the file format is unsupported, the file is corrupted,
                or extracted text is too short to be a real resume. Router should
                map to HTTP 422.
            Exception: Any OpenAI/network/validation failure. Router should map
                to HTTP 502 (upstream AI service failure).
        """
        ...
