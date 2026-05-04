from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.user import User
from app.schemas.cover_letter import (
    CoverLetterListResponse,
    CoverLetterResponse,
    CoverLetterUpdateRequest,
)
from app.services import cover_letter_service
from app.services.cover_letter_service import get_cover_letter_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cover-letters", tags=["cover-letters"])


# ---------------------------------------------------------------------------
# NOTE (ARCH-1, Phase 3.1):
# The Resume model has been removed as part of the migration to the
# Profile-centric architecture. The endpoints that consumed `resume_id`
# (generate, regenerate, export) are stubbed out below with HTTP 503 and
# will be reimplemented in Phase 4 (cover-letter feature rebuild) on top of
# user_profiles + tailored_resumes.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Generate (disabled)
# ---------------------------------------------------------------------------

@router.post("/generate", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def generate_cover_letter() -> dict:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Cover letter generation is being rebuilt for the v2.1 architecture. Coming soon.",
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("/", response_model=CoverLetterListResponse)
def list_cover_letters(
    job_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterListResponse:
    """List all cover letters for the current user, with optional job_id filter."""
    items, total = cover_letter_service.list_cover_letters(
        current_user, db, job_id=job_id, limit=limit, offset=offset
    )
    return CoverLetterListResponse(items=items, total=total)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

@router.get("/{cover_letter_id}", response_model=CoverLetterResponse)
def get_cover_letter(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterResponse:
    """Get a single cover letter by ID."""
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)
    return cl  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.patch("/{cover_letter_id}", response_model=CoverLetterResponse)
def update_cover_letter(
    cover_letter_id: UUID,
    data: CoverLetterUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterResponse:
    """Partially update a cover letter (content, name, style, tone, length, selected variant)."""
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)

    if data.content is not None:
        cl.content = data.content
    if data.name is not None:
        cl.name = data.name
    if data.style is not None:
        cl.style = data.style
    if data.tone is not None:
        cl.tone = data.tone
    if data.length_setting is not None:
        cl.length_setting = data.length_setting
    if data.selected_variant_index is not None:
        cl.selected_variant_index = data.selected_variant_index

    db.commit()
    db.refresh(cl)

    logger.info("Cover letter updated: cl_id=%s user_id=%s", cover_letter_id, current_user.id)
    return cl  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{cover_letter_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_cover_letter(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """Delete a cover letter and its exported file."""
    await cover_letter_service.delete_cover_letter(cover_letter_id, current_user, db)


# ---------------------------------------------------------------------------
# Regenerate (disabled)
# ---------------------------------------------------------------------------

@router.post("/{cover_letter_id}/regenerate", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def regenerate_cover_letter(cover_letter_id: UUID) -> dict:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Cover letter regeneration is being rebuilt for the v2.1 architecture. Coming soon.",
    )


# ---------------------------------------------------------------------------
# Export (disabled — depends on the rewritten generation pipeline)
# ---------------------------------------------------------------------------

@router.post("/{cover_letter_id}/export", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def export_cover_letter(cover_letter_id: UUID) -> dict:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Cover letter export is being rebuilt for the v2.1 architecture. Coming soon.",
    )
