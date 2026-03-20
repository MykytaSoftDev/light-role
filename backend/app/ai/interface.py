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
