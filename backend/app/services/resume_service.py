from __future__ import annotations

import dataclasses
import logging
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.interface import ResumeData
from app.models.enums import FileFormat
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import ResumeUpdate
from app.services import file_service

logger = logging.getLogger(__name__)

_DEFAULT_SECTIONS_ORDER = [
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
]


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------

def get_resume_or_404(resume_id: UUID, user: User, db: Session) -> Resume:
    """Return a resume owned by the user or raise 404."""
    resume = (
        db.query(Resume)
        .filter(Resume.id == resume_id, Resume.user_id == user.id)
        .first()
    )
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    return resume


def get_job_or_404(job_id: UUID, user: User, db: Session) -> Job:
    """Return a job owned by the user or raise 404."""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job


def list_resumes(
    user: User,
    db: Session,
    *,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Resume], int]:
    """Return all resumes for the user, newest first."""
    query = (
        db.query(Resume)
        .filter(Resume.user_id == user.id)
        .order_by(Resume.created_at.desc())
    )
    total: int = query.count()
    resumes = query.limit(limit).offset(offset).all()
    return resumes, total


def create_resume(
    *,
    resume_id: UUID,
    user: User,
    db: Session,
    name: str,
    file_format: FileFormat,
    original_file_path: str,
    job_id: UUID | None,
    raw_text: str,
    content_hash: str | None = None,
) -> Resume:
    """
    Persist a new Resume record.

    The caller pre-generates resume_id so the file path and DB id are always
    in sync. raw_text is stored inside parsed_data as {"raw_text": "..."} so it
    can be retrieved later for AI analysis without re-reading the file from disk.
    content_hash is a SHA-256 of the normalised text used for duplicate detection.
    """
    resume = Resume(
        id=resume_id,
        user_id=user.id,
        job_id=job_id,
        name=name,
        original_file_path=original_file_path,
        original_file_format=file_format,
        sections_order=_DEFAULT_SECTIONS_ORDER,
        parsed_data={"raw_text": raw_text},
        content_hash=content_hash,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    logger.info(
        "Resume created: resume_id=%s user_id=%s format=%s",
        resume.id,
        user.id,
        file_format.value,
    )
    return resume


async def delete_resume(resume_id: UUID, user: User, db: Session) -> None:
    """Delete the resume record and its associated files from disk."""
    resume = get_resume_or_404(resume_id, user, db)

    # Delete files — best-effort, do not fail if file is missing
    await file_service.delete_file(resume.original_file_path)
    if resume.optimized_file_path:
        await file_service.delete_file(resume.optimized_file_path)

    db.delete(resume)
    db.commit()

    logger.info("Resume deleted: resume_id=%s user_id=%s", resume_id, user.id)


def update_resume(resume_id: UUID, user: User, data: ResumeUpdate, db: Session) -> Resume:
    """
    Apply partial updates to a resume record.

    When updating parsed_data, the raw_text extracted at upload time is
    preserved so that future AI operations can still access it even if the
    caller omits it from the payload.
    """
    resume = get_resume_or_404(resume_id, user, db)

    if data.name is not None:
        resume.name = data.name

    if data.parsed_data is not None:
        existing_raw = get_raw_text_from_resume(resume)
        resume.parsed_data = data.parsed_data
        if existing_raw and "raw_text" not in data.parsed_data:
            resume.parsed_data = {**data.parsed_data, "raw_text": existing_raw}

    if data.sections_order is not None:
        resume.sections_order = data.sections_order

    if data.template is not None:
        resume.template = data.template

    db.commit()
    db.refresh(resume)

    logger.info("Resume updated: resume_id=%s user_id=%s", resume_id, user.id)
    return resume


def set_base_resume(resume_id: UUID, user: User, db: Session) -> Resume:
    """Mark a resume as the base and clear the flag from all others."""
    resume = get_resume_or_404(resume_id, user, db)

    # Clear is_base on all other resumes for this user
    (
        db.query(Resume)
        .filter(Resume.user_id == user.id, Resume.id != resume_id)
        .update({"is_base": False}, synchronize_session="fetch")
    )

    resume.is_base = True
    db.commit()
    db.refresh(resume)

    logger.info("Base resume set: resume_id=%s user_id=%s", resume_id, user.id)
    return resume


def apply_analysis_result(
    *,
    resume: Resume,
    parsed_data: ResumeData,
    optimized_data: ResumeData,
    match_score: int,
    keyword_gaps: list[str],
    recommendations: list[str],
    job_id: UUID,
    db: Session,
) -> Resume:
    """
    Persist AI analysis results back onto a Resume record.

    parsed_data and optimized_data are converted from dataclasses to plain
    dicts before storage in the JSONB columns.
    """
    resume.parsed_data = _resume_data_to_dict(parsed_data)
    resume.optimized_data = _resume_data_to_dict(optimized_data)
    resume.match_score = match_score
    resume.ai_recommendations = {
        "keyword_gaps": keyword_gaps,
        "recommendations": recommendations,
    }
    resume.job_id = job_id

    db.commit()
    db.refresh(resume)

    logger.info(
        "Resume analysis applied: resume_id=%s job_id=%s score=%d",
        resume.id,
        job_id,
        match_score,
    )
    return resume


def get_raw_text_from_resume(resume: Resume) -> str:
    """
    Retrieve the raw extracted text stored during upload.

    Returns an empty string if not yet stored.
    """
    if not isinstance(resume.parsed_data, dict):
        return ""
    return resume.parsed_data.get("raw_text", "")


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _resume_data_to_dict(data: ResumeData) -> dict:
    """Convert a ResumeData dataclass (and nested dataclasses) to a plain dict."""
    return dataclasses.asdict(data)
