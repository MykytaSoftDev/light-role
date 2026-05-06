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
# Tailored resume generation dataclass (TAILOR-1)
# ---------------------------------------------------------------------------

@dataclass
class GenerateTailoredResumeResult:
    """Result of an AI-tailored resume generation call (PRD 3.4.A.5 / 6.5).

    All dict-shaped fields are intentionally returned as plain dicts so the
    persistence layer (TAILOR-2) can validate them through
    `app.schemas.tailored_resume.TailoredResumeGenerationResult.model_validate(...)`
    at write time without an extra serialisation hop.

    Fields:
        tailored_data: Full ProfileData-shaped dict (`app.schemas.profile.ProfileData`).
            All canonical section keys are present (empty arrays / nulls when
            unused) so the frontend renderer can iterate `sections_order` and
            pull each section by key.
        matched_keywords: List of `{"term": str, "color_id": int 1..8}` dicts.
            color_id cycles 1..8 for stable, deterministic side-panel colors.
        applied_changes: Dict keyed by section name → list of natural-language
            change descriptions. Only sections the AI actually modified are
            included.
        match_score: Integer 0..100 (clamped).
        usage: Token / latency telemetry. None on failure.
        success: True iff a structurally valid result was produced. On False,
            the dict fields contain a best-effort partial result the caller
            may surface as a 502 to the client.
    """
    tailored_data: dict
    matched_keywords: list[dict]
    applied_changes: dict[str, list[str]]
    match_score: int
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
    async def generate_tailored_resume(
        self,
        profile_data: dict,
        job_data: dict,
        preferences: dict,
    ) -> "GenerateTailoredResumeResult":
        """Produce a tailored resume from a user's profile and a parsed job.

        Args:
            profile_data: A dict conforming to `app.schemas.profile.ProfileData`
                (the user's full profile JSONB). Treated as the immutable
                source of truth — the AI must not invent content beyond it.
            job_data: A dict with at minimum `job_title`, `company`,
                `requirements: list[str]`, and `description: str`.
            preferences: `{"sections_order": list[str], "font": str, "template": str}`
                per `_resume_preferences_default()` in `app.models.user`.

        Returns:
            GenerateTailoredResumeResult. On AI/parse/validation failure the
            method returns `success=False` with best-effort partial data so the
            caller can map to HTTP 502 without consuming the user's quota.
        """
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
