from __future__ import annotations

import logging
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.ai.openai_service import OpenAIService
from app.database import SessionLocal, get_db
from app.dependencies.ai_limit import require_ai_quota
from app.dependencies.auth import get_verified_user
from app.models.enums import FileFormat, NotificationType, OperationType
from app.models.notification import Notification
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import (
    AnalysisStatusResponse,
    AnalysisTaskResponse,
    ResumeAnalyzeRequest,
    ResumeListResponse,
    ResumeResponse,
    ResumeUpdate,
)
from app.redis import increment_usage_count
from app.services import analysis_task_service, file_service, resume_service
from app.services.ai_usage_service import log_ai_operation
from app.services.usage_service import invalidate_usage_cache
from app.services.resume_export import get_docx_builder, user_can_use_template
from app.services.resume_export.types import ResumeData
from app.utils.file_validators import validate_upload_file
from app.utils.pdf_export import generate_pdf
from app.utils.resume_parser import compute_content_hash, extract_text_from_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/resumes", tags=["resumes"])

_ai_service = OpenAIService()


@router.post(
    "/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    file: UploadFile,
    job_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> Response:
    """Upload a resume file (PDF or DOCX). Extracts text, deduplicates by content hash."""
    ext = await validate_upload_file(file)

    file_contents = await file.read()

    raw_text = await extract_text_from_file(file_contents, ext)

    # Validate job ownership when job_id is provided
    if job_id is not None:
        resume_service.get_job_or_404(job_id, current_user, db)

    # Duplicate detection via content hash
    content_hash: str | None = None
    if raw_text:
        content_hash = compute_content_hash(raw_text)
        existing = (
            db.query(Resume)
            .filter(Resume.user_id == current_user.id, Resume.content_hash == content_hash)
            .first()
        )
        if existing is not None:
            # Return the existing resume without saving a new file
            resume_data = ResumeResponse.model_validate(existing)
            return Response(
                content=resume_data.model_dump_json(),
                status_code=status.HTTP_200_OK,
                media_type="application/json",
                headers={"X-Duplicate": "true"},
            )

    # Pre-generate id so the file path and DB record are always in sync
    resume_id = uuid_lib.uuid4()
    relative_path = file_service.get_resume_path(current_user.id, resume_id, ext)
    await file_service.save_upload(file_contents, relative_path)

    # Derive a display name from the filename, stripping the extension
    original_name = file.filename or "resume"
    display_name = original_name.rsplit(".", 1)[0] if "." in original_name else original_name

    resume = resume_service.create_resume(
        resume_id=resume_id,
        user=current_user,
        db=db,
        name=display_name,
        file_format=FileFormat(ext),
        original_file_path=relative_path,
        job_id=job_id,
        raw_text=raw_text,
        content_hash=content_hash,
    )

    return Response(
        content=ResumeResponse.model_validate(resume).model_dump_json(),
        status_code=status.HTTP_201_CREATED,
        media_type="application/json",
    )


@router.get("/", response_model=ResumeListResponse)
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ResumeListResponse:
    """List all resumes for the current user."""
    resumes, total = resume_service.list_resumes(
        current_user, db, limit=limit, offset=offset
    )
    return ResumeListResponse(items=resumes, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


# NOTE: /analysis-status/{task_id} MUST be registered before /{resume_id} to
# avoid FastAPI treating "analysis-status" as a UUID path parameter.
@router.get("/analysis-status/{task_id}", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    task_id: str,
    current_user: User = Depends(get_verified_user),
) -> AnalysisStatusResponse:
    """Poll the status of a background resume analysis task."""
    status_data = await analysis_task_service.get_task_status(task_id)
    if status_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found or expired.")
    if status_data.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return AnalysisStatusResponse(**status_data)


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ResumeResponse:
    """Get a single resume by ID."""
    resume = resume_service.get_resume_or_404(resume_id, current_user, db)
    return resume  # type: ignore[return-value]


@router.patch("/{resume_id}", response_model=ResumeResponse)
def update_resume(
    resume_id: UUID,
    data: ResumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ResumeResponse:
    """Partially update resume content (name, parsed_data, sections_order, template)."""
    if data.template is not None:
        if not user_can_use_template(current_user, data.template):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This template requires a Pro subscription.",
            )
    return resume_service.update_resume(resume_id, current_user, data, db)  # type: ignore[return-value]


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """Delete a resume and its files."""
    await resume_service.delete_resume(resume_id, current_user, db)


@router.patch("/{resume_id}/set-base", response_model=ResumeResponse)
def set_base_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ResumeResponse:
    """Set this resume as the user's base resume."""
    resume = resume_service.set_base_resume(resume_id, current_user, db)
    return resume  # type: ignore[return-value]


@router.post("/analyze", response_model=AnalysisTaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def analyze_resume(
    data: ResumeAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    _quota: None = Depends(require_ai_quota),
) -> AnalysisTaskResponse:
    """
    Start background AI analysis of a resume against a job description.

    Returns immediately with a task_id. Poll GET /analysis-status/{task_id} to
    check progress. On completion a notification is created for the user.
    Consumes 1 AI operation (only on success).
    """
    resume = resume_service.get_resume_or_404(data.resume_id, current_user, db)
    job = resume_service.get_job_or_404(data.job_id, current_user, db)

    resume_text = resume_service.get_raw_text_from_resume(resume)
    if not resume_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume text could not be extracted. Please re-upload the file.",
        )

    job_description = job.description_raw or ""
    if not job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job has no description text to analyze against.",
        )

    task_id = str(uuid_lib.uuid4())
    await analysis_task_service.create_task(
        task_id=task_id,
        resume_id=str(data.resume_id),
        job_id=str(data.job_id),
        user_id=str(current_user.id),
    )

    background_tasks.add_task(
        _run_analysis_background,
        task_id=task_id,
        resume_id=data.resume_id,
        job_id=data.job_id,
        user_id=current_user.id,
        resume_text=resume_text,
        job_description=job_description,
        job_title=job.title,
        company=job.company or "",
    )

    return AnalysisTaskResponse(task_id=task_id, resume_id=data.resume_id)


async def _run_analysis_background(
    task_id: str,
    resume_id: UUID,
    job_id: UUID,
    user_id: UUID,
    resume_text: str,
    job_description: str,
    job_title: str,
    company: str,
) -> None:
    """Background worker: run AI analysis and persist results."""
    await analysis_task_service.update_task_status(task_id, "processing")

    result = await _ai_service.analyze_resume(resume_text, job_description)

    db = SessionLocal()
    try:
        if not result.success:
            await analysis_task_service.update_task_status(task_id, "failed", "AI analysis failed")
            _create_notification(
                db,
                user_id,
                NotificationType.RESUME_ANALYSIS_COMPLETE,
                "Resume analysis failed",
                "Analysis for your resume encountered an error. Please try again.",
            )
            return

        # Fetch resume and persist results
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if resume:
            resume_service.apply_analysis_result(
                resume=resume,
                parsed_data=result.parsed_data,
                optimized_data=result.optimized_data,
                match_score=result.match_score,
                keyword_gaps=result.keyword_gaps,
                recommendations=result.recommendations,
                job_id=job_id,
                db=db,
            )

        # Log AI operation (only on success)
        if result.usage is not None:
            try:
                log_ai_operation(
                    db=db,
                    user_id=user_id,
                    operation_type=OperationType.RESUME_ANALYZE,
                    usage=result.usage,
                )
            except Exception as exc:
                logger.error("Failed to log AI usage for user %s: %s", user_id, exc)

        # Increment Redis usage counter (only on success)
        year_month = datetime.now(timezone.utc).strftime("%Y-%m")
        await increment_usage_count(str(user_id), year_month)

        # Invalidate usage cache
        await invalidate_usage_cache(str(user_id))

        # Create success notification
        score = result.match_score
        title = f"Resume analysis complete \u2014 {score}% match"
        message = (
            f"Your resume scored {score}% for {job_title} at {company}."
            if company
            else f"Your resume scored {score}% for {job_title}."
        )
        _create_notification(db, user_id, NotificationType.RESUME_ANALYSIS_COMPLETE, title, message)

        await analysis_task_service.update_task_status(task_id, "completed")

    except Exception as exc:
        logger.error(
            "Background analysis failed: task_id=%s error=%s", task_id, exc, exc_info=True
        )
        await analysis_task_service.update_task_status(task_id, "failed", str(exc))
    finally:
        db.close()


def _create_notification(
    db: Session,
    user_id: UUID,
    notif_type: NotificationType,
    title: str,
    message: str,
) -> None:
    """Helper to insert and commit a Notification row."""
    notif = Notification(user_id=user_id, type=notif_type, title=title, message=message)
    db.add(notif)
    db.commit()


@router.post("/{resume_id}/export")
async def export_resume(
    resume_id: UUID,
    format: str = Query(default="docx", pattern="^(pdf|docx)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> Response:
    """
    Export a resume as a DOCX or PDF file.

    Uses optimized_data when available (post-analysis), falling back to
    parsed_data. Returns the file as an attachment.
    """
    resume = resume_service.get_resume_or_404(resume_id, current_user, db)

    export_data = resume.optimized_data or resume.parsed_data
    if not export_data or (set(export_data.keys()) <= {"raw_text"}):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume has not been analyzed yet. Please run analysis before exporting.",
        )

    # Authorization check (stub: always passes; enforces when monetization is wired)
    template_id = resume.template or "classic"
    if not user_can_use_template(current_user, template_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This template requires a Pro subscription.",
        )

    safe_name = resume.name.replace(" ", "_") if resume.name else "resume"

    if format == "pdf":
        pdf_bytes = generate_pdf(export_data)  # still fpdf2, Phase 5 will migrate
        relative_path = file_service.get_resume_path(
            current_user.id, resume_id, "pdf", variant="optimized"
        )
        await file_service.save_upload(pdf_bytes, relative_path)
        resume.optimized_file_path = relative_path
        db.commit()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )

    # format == "docx"
    resume_data = ResumeData.model_validate(export_data)
    builder = get_docx_builder(template_id)
    docx_bytes = builder(resume_data)
    relative_path = file_service.get_resume_path(
        current_user.id, resume_id, "docx", variant="optimized"
    )
    await file_service.save_upload(docx_bytes, relative_path)
    resume.optimized_file_path = relative_path
    db.commit()
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )
