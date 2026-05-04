"""Pydantic schemas for AI quality ratings (PRD 6.10).

A user rates an AI-tailored resume 1..5 with an optional comment. The
rating is write-once per resume — there is no update/patch schema.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AIQualityRatingCreateRequest(BaseModel):
    """POST /api/v1/tailored-resumes/{id}/rating."""

    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class AIQualityRatingResponse(BaseModel):
    """Returned after rating creation and via GET endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    tailored_resume_id: UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime
