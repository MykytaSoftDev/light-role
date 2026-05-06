"""Pydantic schemas for tailored resumes (PRD 6.5).

A `TailoredResume` row stores a point-in-time snapshot of the user's
profile, sections order, font, and template along with the AI-generated
tailored data, matched keywords, applied-changes log, and match score.
The shape of `tailored_data` mirrors `ProfileData` (PRD 6.5).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, RootModel

from app.schemas.profile import ProfileData


# `tailored_data` has the exact same structure as the source `profile_data`
# (PRD 6.5). Aliasing keeps a single source of truth for the shape.
TailoredResumeData = ProfileData


class MatchedKeyword(BaseModel):
    """One job-keyword surfaced in the tailored resume (PRD 6.5).

    `color_id` is a 1..8 palette index used by the frontend to color-code
    the highlights consistently between the job page and the resume editor.
    """

    term: str
    color_id: int = Field(..., ge=1, le=8)


class AppliedChanges(RootModel[dict[str, list[str]]]):
    """JSONB { [section_key]: string[] } — natural-language change log.

    Example: {"summary": ["AI rephrased opening line"], "skills": [...]}.
    Section keys are not constrained so the AI can introduce new ones
    without a schema bump.
    """

    pass


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------


class TailoredResumeBase(BaseModel):
    """Fields shared between create-internal and full response."""

    name: str
    tailored_data: TailoredResumeData
    matched_keywords: list[MatchedKeyword]
    applied_changes: AppliedChanges
    match_score: int = Field(..., ge=0, le=100)
    sections_order_snapshot: list[str]
    font_snapshot: str
    template_snapshot: str


class TailoredResumeResponse(TailoredResumeBase):
    """GET /api/v1/tailored-resumes/{id}."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    job_id: UUID
    profile_snapshot: ProfileData  # immutable snapshot at generation time
    rating_modal_shown_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Derived from the joined Job — read-only, never persisted on this row.
    # The editor uses these to render the "Resume tailored for {company}"
    # subtitle without a second round-trip to GET /jobs/{id}.
    job_title: Optional[str] = None
    job_company: Optional[str] = None


class TailoredResumePatchRequest(BaseModel):
    """User edits in the editor.

    Snapshot fields (`profile_snapshot`, `template_snapshot`, `match_score`,
    `matched_keywords`, `applied_changes`) are immutable per PRD 6.5 — they
    are deliberately omitted from this schema so they cannot be patched.
    """

    # `name` mirrors the DB column `tailored_resumes.name` (VARCHAR(255), NOT NULL).
    # `min_length=1` rejects empty-string renames from the inline-edit UI.
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tailored_data: Optional[TailoredResumeData] = None
    sections_order_snapshot: Optional[list[str]] = None
    font_snapshot: Optional[str] = Field(default=None, max_length=50)


class TailoredResumeListItem(BaseModel):
    """Compact list-row shape (drops the heavy snapshot/JSONB fields)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    name: str
    match_score: int
    created_at: datetime
    updated_at: datetime


class TailoredResumeListResponse(BaseModel):
    items: list[TailoredResumeListItem]
    total: int


class TailoredResumeGenerationResult(BaseModel):
    """Internal AI service result — what `generate_tailored_resume()` returns
    before persistence. The persistence layer combines this with the
    snapshot fields (profile, sections order, font, template) to build a
    full row.
    """

    tailored_data: TailoredResumeData
    matched_keywords: list[MatchedKeyword]
    applied_changes: AppliedChanges
    match_score: int = Field(..., ge=0, le=100)
