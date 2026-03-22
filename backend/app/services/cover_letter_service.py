from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.cover_letter import CoverLetter
from app.models.resume import Resume
from app.models.user import User
from app.services import file_service

logger = logging.getLogger(__name__)


def get_cover_letter_or_404(cl_id: UUID, user: User, db: Session) -> CoverLetter:
    """Return a cover letter owned by the user or raise 404."""
    cl = (
        db.query(CoverLetter)
        .filter(CoverLetter.id == cl_id, CoverLetter.user_id == user.id)
        .first()
    )
    if cl is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cover letter not found",
        )
    return cl


def get_resume_text(resume: Resume) -> str:
    """Retrieve the raw text stored in the resume's parsed_data. Returns '' if absent."""
    if not isinstance(resume.parsed_data, dict):
        return ""
    return resume.parsed_data.get("raw_text", "")


def list_cover_letters(
    user: User,
    db: Session,
    *,
    job_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[CoverLetter], int]:
    """Return cover letters for the user, newest first. Optionally filter by job_id."""
    query = (
        db.query(CoverLetter)
        .filter(CoverLetter.user_id == user.id)
        .order_by(CoverLetter.created_at.desc())
    )
    if job_id is not None:
        query = query.filter(CoverLetter.job_id == job_id)
    total: int = query.count()
    items = query.limit(limit).offset(offset).all()
    return items, total


async def delete_cover_letter(cl_id: UUID, user: User, db: Session) -> None:
    """Delete the cover letter record and its file from disk if present."""
    cl = get_cover_letter_or_404(cl_id, user, db)

    if cl.file_path:
        await file_service.delete_file(cl.file_path)

    db.delete(cl)
    db.commit()

    logger.info("Cover letter deleted: cl_id=%s user_id=%s", cl_id, user.id)
