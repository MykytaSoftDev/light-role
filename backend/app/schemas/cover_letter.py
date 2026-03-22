from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import CLLength, CLStyle, CLTone


class CoverLetterVariantSchema(BaseModel):
    content: str
    label: str


class CoverLetterGenerateRequest(BaseModel):
    job_id: UUID
    resume_id: UUID
    style: CLStyle = CLStyle.JOB_MATCHED
    tone: CLTone = CLTone.CONFIDENT
    length: CLLength = CLLength.MEDIUM
    additional_context: str = ""


class CoverLetterRegenerateRequest(BaseModel):
    style: Optional[CLStyle] = None
    tone: Optional[CLTone] = None
    length: Optional[CLLength] = None
    additional_context: Optional[str] = None


class CoverLetterUpdateRequest(BaseModel):
    content: Optional[str] = None
    name: Optional[str] = None
    style: Optional[CLStyle] = None
    tone: Optional[CLTone] = None
    length_setting: Optional[CLLength] = None
    selected_variant_index: Optional[int] = None


class CoverLetterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    job_id: Optional[UUID] = None
    resume_id: Optional[UUID] = None
    name: str
    content: str
    variants: list
    selected_variant_index: Optional[int] = None
    style: CLStyle
    tone: CLTone
    length_setting: CLLength
    additional_context: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CoverLetterListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    job_id: Optional[UUID] = None
    style: CLStyle
    tone: CLTone
    length_setting: CLLength
    file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CoverLetterListResponse(BaseModel):
    items: list[CoverLetterListItem]
    total: int


class GenerateVariantsResponse(BaseModel):
    cover_letter_id: UUID
    variants: list[CoverLetterVariantSchema]
