from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ApplicationStatus


class JobCreate(BaseModel):
    title: str
    company: str
    description_raw: Optional[str] = None
    requirements: list[str] = []
    location: Optional[str] = None
    salary: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    description_raw: Optional[str] = None
    requirements: Optional[list[str]] = None
    location: Optional[str] = None
    salary: Optional[str] = None


class ApplicationUpdate(BaseModel):
    date_applied: Optional[datetime] = None
    deadline: Optional[datetime] = None
    follow_up_date: Optional[datetime] = None
    notes: Optional[str] = None
    excitement_level: Optional[int] = Field(default=None, ge=1, le=5)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    resume_id: Optional[UUID] = None
    cover_letter_id: Optional[UUID] = None
    status: ApplicationStatus
    date_applied: Optional[datetime] = None
    deadline: Optional[datetime] = None
    follow_up_date: Optional[datetime] = None
    excitement_level: Optional[int] = None
    notes: Optional[str] = None
    first_response_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class JobResumeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    match_score: Optional[int] = None
    updated_at: datetime


class JobCoverLetterInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    updated_at: datetime


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    company: str
    description_raw: Optional[str] = None
    requirements: list[str]
    location: Optional[str] = None
    salary: Optional[str] = None
    is_ai_parsed: bool
    created_at: datetime
    updated_at: datetime
    application: Optional[ApplicationResponse] = None
    resumes: list[JobResumeInfo] = []
    cover_letters: list[JobCoverLetterInfo] = []


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Job description parsing (AI)
# ---------------------------------------------------------------------------

class JobParseRequest(BaseModel):
    text: str


class ParsedJobDataResponse(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    requirements: list[str] = []
    location: Optional[str] = None
    salary: Optional[str] = None


class JobParseResponse(BaseModel):
    data: ParsedJobDataResponse
    success: bool
