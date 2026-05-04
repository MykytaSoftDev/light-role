"""Pydantic schemas for cover letters (PRD 6.6, 3.5).

Restructured for v2.1 — drops legacy `variants`/`selected_variant_index`/
`file_path`/`length_setting` API fields. The wizard generates 3 variants
in-memory; only the chosen one is persisted as a Tiptap JSON document.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
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
# Generation flow (PRD 3.5.7)
# ---------------------------------------------------------------------------


class CoverLetterGenerateRequest(BaseModel):
    """POST /api/v1/jobs/{id}/cover-letter — generates 3 variants.

    No row is created at this point; the variants are returned in-memory
    for the user to pick from in step 4 of the wizard.
    """

    source_type: SourceType
    style: CLStyleStr = "job_matched"
    tone: CLToneStr = "confident"
    length: CLLengthStr = "medium"
    additional_context: Optional[str] = None


class CoverLetterVariant(BaseModel):
    """One of the 3 AI-generated variants returned by the AI service.

    Plain text from the AI; the frontend (or persistence layer) converts
    it to a Tiptap JSON document when the user finalizes a choice.
    """

    content: str


class CoverLetterGenerationResult(BaseModel):
    """Returned to step 3 of the wizard before user picks a variant.

    Always exactly 3 variants per PRD 3.5.7.
    """

    variants: list[CoverLetterVariant]


# ---------------------------------------------------------------------------
# Persistence (PRD 6.6)
# ---------------------------------------------------------------------------


class CoverLetterCreateRequest(BaseModel):
    """POST /api/v1/cover-letters — finalize wizard, create the row.

    The frontend sends the chosen variant after converting it to Tiptap
    JSON, plus the source snapshot and the wizard inputs.
    """

    job_id: UUID
    name: str
    content: dict  # Tiptap JSON document
    source_type: SourceType
    source_snapshot: dict  # full point-in-time copy of the source
    style: CLStyleStr
    tone: CLToneStr
    length: CLLengthStr
    additional_context: Optional[str] = None


class CoverLetterPatchRequest(BaseModel):
    """User edits content in the editor.

    style/tone/length/source_type/source_snapshot are immutable per
    PRD 6.6 — they are deliberately omitted so they cannot be patched.
    """

    name: Optional[str] = None
    content: Optional[dict] = None  # Tiptap JSON


class CoverLetterResponse(BaseModel):
    # `populate_by_name=True` lets the alias-mapped `length` field still be
    # supplied by its API name in input contexts; `from_attributes=True`
    # lets `length` read from the SQLAlchemy attribute named `length_setting`.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    user_id: UUID
    job_id: Optional[UUID] = None
    name: str
    source_type: SourceType
    source_snapshot: dict
    content: dict  # Tiptap JSON
    style: CLStyleStr
    tone: CLToneStr
    # Maps DB column `length_setting` → API field `length`. ARCH-10 flagged
    # this column for a future rename migration; once renamed, the alias
    # can be removed.
    length: CLLengthStr = Field(alias="length_setting")
    additional_context: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CoverLetterListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    job_id: Optional[UUID] = None
    name: str
    source_type: SourceType
    style: CLStyleStr
    tone: CLToneStr
    # See note in CoverLetterResponse above re: `length_setting` alias.
    length: CLLengthStr = Field(alias="length_setting")
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
