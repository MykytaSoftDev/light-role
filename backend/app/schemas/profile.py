"""Pydantic schemas for the v2.1 user profile (PRD 6.4).

Per ARCH-11 acceptance criteria, validation is structural only:
no email format, no URL format, no phone format. Only required-fields
and types are enforced.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Sub-schemas for the profile_data JSONB structure (PRD 6.4)
# ---------------------------------------------------------------------------
# All `id` fields are `Optional[UUID]` because the frontend generates them
# client-side via `crypto.randomUUID()` (PRD 3.3.16). The same schema serves
# as both input (id may be null on a brand-new entry) and output (id is set).


class SocialLink(BaseModel):
    id: Optional[UUID] = None
    platform: str  # whitelisted in the UI; backend accepts any string
    url: str  # NOT validated as a URL (ARCH-11 policy)


class PersonalInfo(BaseModel):
    full_name: str
    email: str  # plain str, NOT EmailStr (ARCH-11 policy)
    phone: str  # NOT validated as a phone number (ARCH-11 policy)
    location: Optional[str] = None
    social_links: list[SocialLink] = []


class EmploymentEntry(BaseModel):
    id: Optional[UUID] = None
    role: str
    company: str
    location: Optional[str] = None
    start_date: str  # "YYYY-MM" — kept as string per PRD spec (month/year picker)
    end_date: Optional[str] = None
    is_current: bool = False
    details: list[str] = []  # bullet points


class EducationEntry(BaseModel):
    id: Optional[UUID] = None
    degree: str
    institution: str
    field_of_study: Optional[str] = None
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    is_current: bool = False
    description: Optional[str] = None


class SkillEntry(BaseModel):
    id: Optional[UUID] = None
    name: str
    category: Optional[str] = None  # reserved for future use
    level: Optional[str] = None  # reserved for future use


class ProjectEntry(BaseModel):
    id: Optional[UUID] = None
    name: str
    description: str
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    technologies: list[str] = []
    url: Optional[str] = None
    repository_url: Optional[str] = None
    details: list[str] = []


class LanguageEntry(BaseModel):
    id: Optional[UUID] = None
    name: str


class CertificateEntry(BaseModel):
    id: Optional[UUID] = None
    name: str
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_url: Optional[str] = None


class AchievementEntry(BaseModel):
    id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    date: Optional[str] = None
    issuer: Optional[str] = None


class VolunteerEntry(BaseModel):
    id: Optional[UUID] = None
    role: str
    organization: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    is_current: bool = False
    details: list[str] = []


class ProfileData(BaseModel):
    """The full profile_data JSONB structure (PRD 6.4).

    Every section defaults to empty so a freshly created profile (or one
    persisted as `{}`) can be parsed without errors. `personal_info` is
    optional because a new user's profile may not have it filled in yet.
    """

    personal_info: Optional[PersonalInfo] = None
    summary: str = ""
    employment: list[EmploymentEntry] = []
    education: list[EducationEntry] = []
    skills: list[SkillEntry] = []
    projects: list[ProjectEntry] = []
    languages: list[LanguageEntry] = []
    certificates: list[CertificateEntry] = []
    achievements: list[AchievementEntry] = []
    volunteer: list[VolunteerEntry] = []


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------


class ProfileResponse(BaseModel):
    """Returned by GET /api/v1/profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    profile_data: ProfileData
    created_at: datetime
    updated_at: datetime


class ProfilePatchRequest(BaseModel):
    """Partial update — any subset of profile_data sections.

    PATCH /api/v1/profile merges these into the existing profile_data so the
    frontend can update one section at a time without sending the full blob.
    """

    personal_info: Optional[PersonalInfo] = None
    summary: Optional[str] = None
    employment: Optional[list[EmploymentEntry]] = None
    education: Optional[list[EducationEntry]] = None
    skills: Optional[list[SkillEntry]] = None
    projects: Optional[list[ProjectEntry]] = None
    languages: Optional[list[LanguageEntry]] = None
    certificates: Optional[list[CertificateEntry]] = None
    achievements: Optional[list[AchievementEntry]] = None
    volunteer: Optional[list[VolunteerEntry]] = None


class ProfileReadinessResponse(BaseModel):
    """Lightweight check used by the frontend before triggering Tailor flow."""

    is_ready: bool
    has_employment: bool
    has_projects: bool
