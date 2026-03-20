from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.enums import FileFormat


# ---------------------------------------------------------------------------
# Nested AI data schemas (mirrors interface.py dataclasses for API responses)
# ---------------------------------------------------------------------------

class PersonalInfoSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    summary: Optional[str] = None


class ExperienceItemSchema(BaseModel):
    company: str = ""
    title: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current: bool = False
    description: str = ""
    achievements: list[str] = []


class EducationItemSchema(BaseModel):
    institution: str = ""
    degree: str = ""
    field: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None


class CertificationItemSchema(BaseModel):
    name: str = ""
    issuer: Optional[str] = None
    date: Optional[str] = None


class ResumeDataSchema(BaseModel):
    personal_info: PersonalInfoSchema = PersonalInfoSchema()
    summary: Optional[str] = None
    experience: list[ExperienceItemSchema] = []
    education: list[EducationItemSchema] = []
    skills: list[str] = []
    languages: list[str] = []
    certifications: list[CertificationItemSchema] = []


# ---------------------------------------------------------------------------
# Resume update schema
# ---------------------------------------------------------------------------

class ResumeUpdate(BaseModel):
    name: Optional[str] = None
    parsed_data: Optional[dict] = None
    sections_order: Optional[list] = None
    template: Optional[str] = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ResumeUpdate":
        if all(v is None for v in [self.name, self.parsed_data, self.sections_order, self.template]):
            raise ValueError("At least one field must be provided for update.")
        return self


# ---------------------------------------------------------------------------
# Resume CRUD schemas
# ---------------------------------------------------------------------------

class ResumeListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    job_id: Optional[UUID] = None
    match_score: Optional[int] = None
    is_base: bool
    original_file_format: FileFormat
    template: str
    created_at: datetime
    updated_at: datetime


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    job_id: Optional[UUID] = None
    original_file_format: FileFormat
    parsed_data: Optional[dict] = None
    optimized_data: Optional[dict] = None
    match_score: Optional[int] = None
    ai_recommendations: Optional[dict] = None
    sections_order: list
    is_base: bool
    template: str
    created_at: datetime
    updated_at: datetime


class ResumeListResponse(BaseModel):
    items: list[ResumeListItem]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Resume analyze request/response
# ---------------------------------------------------------------------------

class ResumeAnalyzeRequest(BaseModel):
    resume_id: UUID
    job_id: UUID


class ResumeAnalysisResponse(BaseModel):
    resume_id: UUID
    match_score: int
    keyword_gaps: list[str]
    recommendations: list[str]
    parsed_data: ResumeDataSchema
    optimized_data: ResumeDataSchema


class AnalysisTaskResponse(BaseModel):
    task_id: str
    resume_id: UUID


class AnalysisStatusResponse(BaseModel):
    status: str  # pending | processing | completed | failed
    resume_id: str
    job_id: str
    user_id: str
    error: Optional[str] = None
