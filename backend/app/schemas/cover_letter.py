"""Pydantic schemas for cover letters (PRD 6.6, 3.5).

Restructured for v2.1 — drops legacy `variants`/`selected_variant_index`/
`file_path`/`length_setting` API fields. The wizard generates 3 variants
in-memory; only the chosen one is persisted as a Tiptap JSON document.

The two main endpoints used by the wizard are:
  - CL-2: POST /api/v1/jobs/{job_id}/cover-letter →
        request:  CoverLetterGenerateRequest
        response: CoverLetterGenerateResponse  (3 in-memory variants)
  - CL-3: POST /api/v1/cover-letters →
        request:  CoverLetterFinalizeRequest
        response: CoverLetterResponse          (persisted row)
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# String literals (not Python Enum) for forward-compat: ARCH-10 flagged
# the DB switching style/tone/length from PG ENUM to VARCHAR. Keeping the
# wire format as plain strings means that future migration is a no-op for
# API consumers.
SourceType = Literal["tailored_resume", "profile"]
CLStyleStr = Literal["formal", "professional", "job_matched"]
CLToneStr = Literal["confident", "humble", "enthusiastic"]
CLLengthStr = Literal["short", "medium", "long"]


# ---------------------------------------------------------------------------
# Generation flow (PRD 3.5.7) — CL-2
# ---------------------------------------------------------------------------


class CoverLetterGenerateRequest(BaseModel):
    """POST /api/v1/jobs/{job_id}/cover-letter — generate 3 variants.

    No row is created at this point; the variants are returned in-memory
    for the user to pick from in step 4 of the wizard. Credit IS consumed
    here on AI success — the finalize endpoint (CL-3) is then idempotent.
    """

    source_type: SourceType
    style: CLStyleStr = "job_matched"
    tone: CLToneStr = "confident"
    length: CLLengthStr = "medium"
    additional_context: Optional[str] = Field(default=None, max_length=2000)


class CoverLetterVariantResponse(BaseModel):
    """One of the 3 AI-generated variants (CL-2 response).

    Plain text from the AI; the frontend converts it to a Tiptap JSON
    document only when the user finalizes a choice (CL-3).
    """

    content: str


class CoverLetterGenerateResponse(BaseModel):
    """Returned to step 3 of the wizard before user picks a variant.

    Always exactly 3 variants per PRD 3.5.7.
    """

    variants: list[CoverLetterVariantResponse]


# Legacy aliases — kept so any older consumer importing these names still
# works. New code should import the *Response variants above.
CoverLetterVariant = CoverLetterVariantResponse
CoverLetterGenerationResult = CoverLetterGenerateResponse


# ---------------------------------------------------------------------------
# Persistence (PRD 6.6) — CL-3
# ---------------------------------------------------------------------------


class CoverLetterFinalizeRequest(BaseModel):
    """POST /api/v1/cover-letters — finalize wizard, create the row.

    The frontend sends the chosen variant after either:
      - converting it to Tiptap JSON (preferred) — `content` is a dict, OR
      - leaving it as plain text — `content` is a str. The server wraps it
        into a minimal Tiptap document JSON before persisting.

    `source_snapshot` is the immutable point-in-time copy of the source
    used for generation (per PRD 6.6) — the wizard already loaded this
    in memory for the AI call, so it sends it back here. The server does
    NOT re-fetch from `tailored_resumes`/`user_profiles` to materialise
    it; that keeps CL-3 dumb and idempotent.
    """

    job_id: UUID
    name: str = Field(min_length=1, max_length=255)
    content: Union[dict, str]
    source_type: SourceType
    source_snapshot: dict
    style: CLStyleStr
    tone: CLToneStr
    length: CLLengthStr
    additional_context: Optional[str] = Field(default=None, max_length=2000)


# Backward-compat alias for any test or import that still uses the older name.
CoverLetterCreateRequest = CoverLetterFinalizeRequest


class CoverLetterPatchRequest(BaseModel):
    """User edits content in the editor.

    style/tone/length/source_type/source_snapshot are immutable per
    PRD 6.6 — they are deliberately omitted so they cannot be patched.
    """

    name: Optional[str] = None
    content: Optional[dict] = None  # Tiptap JSON


class CoverLetterResponse(BaseModel):
    # `from_attributes=True` lets `length` read from the SQLAlchemy attribute
    # named `length_setting` via `validation_alias`. The alias applies to
    # input/ORM lookup only — JSON output uses the field name `length`.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    job_id: Optional[UUID] = None
    name: str
    source_type: SourceType
    source_snapshot: dict
    content: dict  # Tiptap JSON
    style: CLStyleStr
    tone: CLToneStr
    # Reads DB column `length_setting` via `validation_alias`; JSON output
    # is `length`. ARCH-10 flagged this column for a future rename
    # migration; once renamed, the alias can be removed.
    length: CLLengthStr = Field(validation_alias="length_setting")
    additional_context: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CoverLetterListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: Optional[UUID] = None
    name: str
    source_type: SourceType
    style: CLStyleStr
    tone: CLToneStr
    # See note in CoverLetterResponse above — `validation_alias` maps the
    # SQLAlchemy attr `length_setting` in; JSON output is `length`.
    length: CLLengthStr = Field(validation_alias="length_setting")
    created_at: datetime
    updated_at: datetime


class CoverLetterListResponse(BaseModel):
    items: list[CoverLetterListItem]
    total: int


# ---------------------------------------------------------------------------
# Legacy compatibility shims
# ---------------------------------------------------------------------------
# The pre-v2.1 router (app/routers/cover_letters.py) still imports
# `CoverLetterUpdateRequest`. Phase 4 will rebuild that endpoint to use
# `CoverLetterPatchRequest` above; until then, keep this shim so the app
# still imports. The shape mirrors the legacy schema (style/tone/length
# kept under the legacy `length_setting` key, plus the deprecated
# selected_variant_index field).
from app.models.enums import CLLength, CLStyle, CLTone  # noqa: E402  (legacy import)


class CoverLetterUpdateRequest(BaseModel):
    """DEPRECATED — kept for legacy router compatibility. Phase 4 will
    replace its use with `CoverLetterPatchRequest`.
    """

    content: Optional[str] = None
    name: Optional[str] = None
    style: Optional[CLStyle] = None
    tone: Optional[CLTone] = None
    length_setting: Optional[CLLength] = None
    selected_variant_index: Optional[int] = None
