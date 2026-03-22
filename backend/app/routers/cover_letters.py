from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.ai.openai_service import OpenAIService
from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.cover_letter import CoverLetter
from app.models.enums import OperationType
from app.models.user import User
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.cover_letter import (
    CoverLetterGenerateRequest,
    CoverLetterListResponse,
    CoverLetterRegenerateRequest,
    CoverLetterResponse,
    CoverLetterUpdateRequest,
    CoverLetterVariantSchema,
    GenerateVariantsResponse,
)
from app.services import cover_letter_service, file_service
from app.services.ai_usage_service import log_ai_operation
from app.services.cover_letter_service import get_cover_letter_or_404
from app.services.resume_service import get_job_or_404, get_resume_or_404
from app.services.usage_service import invalidate_usage_cache
from app.utils.cover_letter_export import generate_cover_letter_docx, generate_cover_letter_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cover-letters", tags=["cover-letters"])

_ai_service = OpenAIService()


# ---------------------------------------------------------------------------
# Generate
# ---------------------------------------------------------------------------

@router.post(
    "/generate",
    response_model=GenerateVariantsResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_cover_letter(
    data: CoverLetterGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> GenerateVariantsResponse:
    """
    Generate 3 cover letter variants using AI.

    Requires a valid job_id and resume_id owned by the current user.
    Consumes 1 AI operation on success.
    """
    job = get_job_or_404(data.job_id, current_user, db)
    resume = get_resume_or_404(data.resume_id, current_user, db)

    job_description = job.description_raw or ""
    resume_text = cover_letter_service.get_resume_text(resume)

    result = await _ai_service.generate_cover_letter(
        job_description=job_description,
        resume_text=resume_text,
        style=data.style.value,
        tone=data.tone.value,
        length=data.length.value,
        additional_context=data.additional_context,
    )

    if not result.success or not result.variants:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cover letter generation failed. Please try again.",
        )

    cl_name = f"Cover Letter — {job.title} at {job.company or 'Company'}"
    variants_json = [{"content": v.content, "label": v.label} for v in result.variants]

    cl = CoverLetter(
        user_id=current_user.id,
        job_id=job.id,
        resume_id=resume.id,
        name=cl_name,
        content=result.variants[0].content,
        variants=variants_json,
        selected_variant_index=0,
        style=data.style,
        tone=data.tone,
        length_setting=data.length,
        additional_context=data.additional_context or None,
    )
    db.add(cl)
    db.commit()
    db.refresh(cl)

    # Log AI operation (only on success)
    if result.usage is not None:
        try:
            log_ai_operation(
                db=db,
                user_id=current_user.id,
                operation_type=OperationType.CL_GENERATE,
                usage=result.usage,
            )
        except Exception as exc:
            logger.error("Failed to log AI usage for user %s: %s", current_user.id, exc)

    await invalidate_usage_cache(str(current_user.id))

    logger.info(
        "Cover letter generated: cl_id=%s user_id=%s job_id=%s variants=%d",
        cl.id,
        current_user.id,
        job.id,
        len(result.variants),
    )

    return GenerateVariantsResponse(
        cover_letter_id=cl.id,
        variants=[CoverLetterVariantSchema(content=v.content, label=v.label) for v in result.variants],
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
# Regenerate
# ---------------------------------------------------------------------------

@router.post(
    "/{cover_letter_id}/regenerate",
    response_model=GenerateVariantsResponse,
)
async def regenerate_cover_letter(
    cover_letter_id: UUID,
    data: CoverLetterRegenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> GenerateVariantsResponse:
    """
    Regenerate cover letter variants using AI.

    Uses the stored settings as defaults, overriding any fields provided in the request.
    Consumes 1 AI operation on success.
    """
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)

    # Resolve effective settings: use stored value unless request overrides it
    effective_style = data.style if data.style is not None else cl.style
    effective_tone = data.tone if data.tone is not None else cl.tone
    effective_length = data.length if data.length is not None else cl.length_setting
    effective_context = data.additional_context if data.additional_context is not None else (cl.additional_context or "")

    # Fetch job and resume for their text
    job_description = ""
    resume_text = ""

    if cl.job_id is not None:
        job = (
            db.query(Job)
            .filter(Job.id == cl.job_id, Job.user_id == current_user.id)
            .first()
        )
        if job is not None:
            job_description = job.description_raw or ""

    if cl.resume_id is not None:
        resume = (
            db.query(Resume)
            .filter(Resume.id == cl.resume_id, Resume.user_id == current_user.id)
            .first()
        )
        if resume is not None:
            resume_text = cover_letter_service.get_resume_text(resume)

    result = await _ai_service.generate_cover_letter(
        job_description=job_description,
        resume_text=resume_text,
        style=effective_style.value,
        tone=effective_tone.value,
        length=effective_length.value,
        additional_context=effective_context,
    )

    if not result.success or not result.variants:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cover letter generation failed. Please try again.",
        )

    variants_json = [{"content": v.content, "label": v.label} for v in result.variants]

    # Update CL with new variants and apply any setting overrides
    cl.variants = variants_json
    cl.content = result.variants[0].content
    cl.selected_variant_index = 0
    cl.style = effective_style
    cl.tone = effective_tone
    cl.length_setting = effective_length
    if data.additional_context is not None:
        cl.additional_context = data.additional_context or None

    db.commit()
    db.refresh(cl)

    # Log AI operation (only on success)
    if result.usage is not None:
        try:
            log_ai_operation(
                db=db,
                user_id=current_user.id,
                operation_type=OperationType.CL_REGENERATE,
                usage=result.usage,
            )
        except Exception as exc:
            logger.error("Failed to log AI usage for user %s: %s", current_user.id, exc)

    await invalidate_usage_cache(str(current_user.id))

    logger.info(
        "Cover letter regenerated: cl_id=%s user_id=%s variants=%d",
        cover_letter_id,
        current_user.id,
        len(result.variants),
    )

    return GenerateVariantsResponse(
        cover_letter_id=cl.id,
        variants=[CoverLetterVariantSchema(content=v.content, label=v.label) for v in result.variants],
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.post("/{cover_letter_id}/export")
async def export_cover_letter(
    cover_letter_id: UUID,
    format: str = Query(default="pdf", pattern="^(pdf|docx)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> Response:
    """
    Export a cover letter as PDF or DOCX.

    Saves the generated file to storage and returns it as an attachment.
    Does not consume an AI operation.
    """
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)

    if not cl.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cover letter has no content to export.",
        )

    safe_name = (
        cl.name.encode("ascii", errors="ignore").decode("ascii").replace(" ", "_")
        if cl.name
        else "cover_letter"
    ) or "cover_letter"

    if format == "pdf":
        pdf_bytes = generate_cover_letter_pdf(cl.content, cl.name)
        relative_path = file_service.get_cover_letter_path(current_user.id, cover_letter_id, "pdf")
        await file_service.save_upload(pdf_bytes, relative_path)
        cl.file_path = relative_path
        db.commit()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )

    # format == "docx"
    docx_bytes = generate_cover_letter_docx(cl.content, cl.name)
    relative_path = file_service.get_cover_letter_path(current_user.id, cover_letter_id, "docx")
    await file_service.save_upload(docx_bytes, relative_path)
    cl.file_path = relative_path
    db.commit()
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )
