"""Profile CRUD endpoints (PRD 3.3.16, 5.2)."""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.openai_service import OpenAIService
from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.usage_log import UsageLog
from app.models.user import User
from app.schemas.profile import (
    ProfileData,
    ProfilePatchRequest,
    ProfileResponse,
)
from app.services.profile_service import (
    get_or_create_profile,
    merge_profile_sections,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])

# Reuse the project-wide pattern (see app/routers/jobs.py:42): a single
# module-level OpenAIService instance shared across requests.
_ai_service = OpenAIService()

# Per PRD 3.3.12: only PDF and DOCX accepted, max 10MB.
ALLOWED_FILE_FORMATS = {"pdf", "docx"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

_PDF_CONTENT_TYPES = {"application/pdf"}
_DOCX_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _serialize(profile) -> ProfileResponse:
    """Build a ProfileResponse, explicitly coercing the JSONB dict.

    ``profile.profile_data`` is a plain ``dict`` at the SQLAlchemy level, so we
    construct ``ProfileData`` from it explicitly rather than relying on
    ``from_attributes=True`` to recurse into a nested Pydantic model.
    """
    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        profile_data=ProfileData.model_validate(profile.profile_data or {}),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def _detect_file_format(file: UploadFile) -> Optional[str]:
    """Detect the resume file format from extension first, then MIME type.

    We trust the filename extension as the primary signal because some clients
    upload PDFs/DOCX with ``application/octet-stream`` or other generic MIME
    types. Content-type is consulted as a fallback only.

    Returns ``"pdf"``, ``"docx"``, or ``None`` if neither signal yields a
    recognised format.
    """
    # Primary: filename extension (most reliable across clients).
    name = (file.filename or "").lower().strip()
    if name.endswith(".pdf"):
        return "pdf"
    if name.endswith(".docx"):
        return "docx"

    # Fallback: declared content-type header.
    content_type = (file.content_type or "").lower().strip()
    if content_type in _PDF_CONTENT_TYPES:
        return "pdf"
    if content_type in _DOCX_CONTENT_TYPES:
        return "docx"

    return None


def _log_usage(
    db: Session,
    user_id: UUID,
    success: bool,
    profile_id: Optional[UUID] = None,
) -> None:
    """Insert a free-tier audit row for a Reset Profile attempt.

    Independent commit: the usage_log row is committed separately from the
    profile mutation so the audit trail records every attempt — even ones
    where the AI call failed and the profile was never touched. If this
    insert itself fails we swallow the error: an audit-log glitch must not
    break the user-facing endpoint.
    """
    try:
        log = UsageLog(
            user_id=user_id,
            operation_type="parse_profile",
            cost_type="free",
            entity_type="profile" if profile_id is not None else None,
            entity_id=profile_id,
            success=success,
        )
        db.add(log)
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "Failed to write usage_log for user %s (parse_profile): %s",
            user_id,
            exc,
        )
        db.rollback()


@router.get("", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ProfileResponse:
    profile = get_or_create_profile(current_user.id, db)
    return _serialize(profile)


@router.patch("", response_model=ProfileResponse)
def patch_profile(
    data: ProfilePatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ProfileResponse:
    profile = get_or_create_profile(current_user.id, db)
    profile = merge_profile_sections(profile, data, db)
    return _serialize(profile)


@router.post("/reset", response_model=ProfileResponse)
async def reset_profile(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ProfileResponse:
    """Replace the user's profile by uploading a resume (PRD 3.3.12).

    Multipart upload of a single PDF or DOCX. Bytes are processed entirely
    in-memory by ``parse_resume_to_profile`` (no temp files). On success the
    profile_data JSONB is OVERWRITTEN wholesale (not merged).

    This endpoint is FREE — does not consume any AI credits. Every attempt
    (success or failure) is logged in usage_log with cost_type='free' for
    audit/analytics purposes.
    """
    # 1. Validate file type before reading anything into memory.
    file_format = _detect_file_format(file)
    if file_format not in ALLOWED_FILE_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF and DOCX files are supported.",
        )

    # 2. Read bytes (in-memory only — never written to disk).
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty.",
        )
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File exceeds maximum size of 10 MB.",
        )

    # 3. Ensure the user has a profile row (auto-creates if missing).
    profile = get_or_create_profile(current_user.id, db)

    # 4. Call the AI parser. Per PROFILE-2 contract:
    #      - ValueError       → 422 (bad input file: unreadable, empty, malformed)
    #      - any other Exception → 502 (AI / network / OpenAI failure)
    try:
        result = await _ai_service.parse_resume_to_profile(file_bytes, file_format)
    except ValueError as exc:
        _log_usage(db, current_user.id, success=False)
        logger.info(
            "Profile reset: invalid %s file for user %s: %s",
            file_format,
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Couldn't parse the resume. Please try a different file.",
        )
    except Exception as exc:
        _log_usage(db, current_user.id, success=False)
        logger.warning(
            "Profile reset: AI service failure for user %s: %s",
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable. Please try again.",
        )

    if not result.success:
        _log_usage(db, current_user.id, success=False)
        logger.warning(
            "Profile reset: AI returned unsuccessful result for user %s",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service returned an unsuccessful result.",
        )

    # 5. OVERWRITE profile_data wholesale (NOT a merge — Reset Profile
    #    semantics per PRD 3.3.12). Reassign the dict so SQLAlchemy detects
    #    the JSONB change (in-place mutation is not tracked by default).
    profile.profile_data = result.profile_data
    db.commit()
    db.refresh(profile)

    # 6. Audit success (separate commit — see _log_usage docstring).
    _log_usage(db, current_user.id, success=True, profile_id=profile.id)

    logger.info("Profile reset complete for user %s", current_user.id)

    return _serialize(profile)
