from __future__ import annotations

import copy
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.ai.openai_service import OpenAIService
from app.database import get_db
from app.dependencies.ai_limit import require_ai_quota
from app.dependencies.auth import get_verified_user
from app.models.application import Application
from app.models.cover_letter import CoverLetter
from app.models.enums import ApplicationStatus, NotificationType
from app.models.job import Job
from app.models.notification import Notification
from app.models.subscription import Subscription
from app.models.tailored_resume import TailoredResume
from app.models.usage_log import UsageLog
from app.models.user import User
from app.redis import increment_usage_count
from app.routers.tailored_resumes import _serialize as _serialize_tailored_resume
from app.schemas.cover_letter import (
    CoverLetterGenerateRequest,
    CoverLetterGenerateResponse,
    CoverLetterVariantResponse,
)
from app.schemas.job import (
    ApplicationResponse,
    ApplicationStatusUpdate,
    ApplicationUpdate,
    JobCreate,
    JobListResponse,
    JobParseRequest,
    JobParseResponse,
    JobResponse,
    JobUpdate,
    ParsedJobDataResponse,
)
from app.schemas.tailored_resume import (
    TailoredResumeGenerationResult,
    TailoredResumeResponse,
)
from app.services import analytics_service, job_service
from app.services.profile_service import get_or_create_profile
from app.services.subscription_service import get_effective_plan
from app.services.usage_service import invalidate_usage_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["jobs"])

_ai_service = OpenAIService()


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@router.post("/jobs/parse", response_model=JobParseResponse)
async def parse_job_description(
    data: JobParseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    _quota: None = Depends(require_ai_quota),
) -> JobParseResponse:
    result = await _ai_service.parse_job_description(data.text)

    # TODO(Phase 5.1): write `usage_log` row (operation_type="parse_job",
    # cost_type="free") and decrement quota under the new credit system.
    if result.success and result.usage is not None:
        year_month = datetime.now(timezone.utc).strftime("%Y-%m")
        await increment_usage_count(str(current_user.id), year_month)

    parsed = ParsedJobDataResponse(
        job_title=result.data.job_title,
        company=result.data.company,
        requirements=result.data.requirements,
        location=result.data.location,
        salary=result.data.salary,
    )
    return JobParseResponse(data=parsed, success=result.success)


_ACTIVE_JOB_LIMIT_FREE = 10
_TERMINAL_STATUSES = [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
]


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> JobResponse:
    subscription = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    effective_plan = get_effective_plan(subscription)

    if effective_plan == "free":
        active_count = (
            db.query(func.count(Job.id))
            .join(Application, Application.job_id == Job.id)
            .filter(
                Job.user_id == current_user.id,
                Application.status.notin_(_TERMINAL_STATUSES),
            )
            .scalar()
        ) or 0

        if active_count >= _ACTIVE_JOB_LIMIT_FREE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Active jobs limit reached",
                    "current_count": active_count,
                    "limit": _ACTIVE_JOB_LIMIT_FREE,
                    "upgrade_url": "/dashboard/upgrade",
                },
            )

    job = job_service.create_job(data, current_user, db)
    background_tasks.add_task(analytics_service.invalidate_analytics_cache, str(current_user.id))
    return job


@router.get("/jobs", response_model=JobListResponse)
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    status: Optional[ApplicationStatus] = Query(default=None),
    company: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    sort_by: str = Query(default="created_at", pattern="^(title|company|created_at|date_applied)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> JobListResponse:
    jobs, total = job_service.get_jobs(
        current_user,
        db,
        status=status,
        company=company,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )
    return JobListResponse(items=jobs, total=total, limit=limit, offset=offset)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> JobResponse:
    return job_service.get_job(job_id, current_user, db)


@router.patch("/jobs/{job_id}", response_model=JobResponse)
def update_job(
    job_id: UUID,
    data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> JobResponse:
    return job_service.update_job(job_id, data, current_user, db)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    job_service.delete_job(job_id, current_user, db)
    background_tasks.add_task(analytics_service.invalidate_analytics_cache, str(current_user.id))


# ---------------------------------------------------------------------------
# Tailored Resume — generation (TAILOR-2)
# ---------------------------------------------------------------------------


def _log_tailor_usage(
    db: Session,
    user_id: UUID,
    success: bool,
    entity_id: Optional[UUID] = None,
) -> None:
    """Insert a `usage_log` audit row for a tailor-resume attempt.

    Independent commit so an audit-glitch never blocks the user-facing
    response (mirrors the pattern in `app/routers/profile.py:_log_usage`).
    """
    try:
        log = UsageLog(
            user_id=user_id,
            operation_type="tailor_resume",
            cost_type="resume_credit",
            entity_type="tailored_resume" if entity_id is not None else None,
            entity_id=entity_id,
            success=success,
        )
        db.add(log)
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "Failed to write usage_log for user %s (tailor_resume): %s",
            user_id,
            exc,
        )
        db.rollback()


def _profile_is_ready(profile_data: dict) -> bool:
    """Readiness rule per PRD 3.4.A.2: ≥1 employment OR ≥1 project entry."""
    if not profile_data:
        return False
    employment = profile_data.get("employment") or []
    projects = profile_data.get("projects") or []
    return len(employment) > 0 or len(projects) > 0


def _build_tailored_resume_name(job: Job) -> str:
    """Derive a default human-readable name for the new TailoredResume row."""
    title = (job.title or "").strip()
    company = (job.company or "").strip()
    if title and company:
        candidate = f"{title} — {company}"
    elif title:
        candidate = title
    elif company:
        candidate = company
    else:
        candidate = f"Resume for job {job.id}"
    # `name` column is VARCHAR(255).
    return candidate[:255]


@router.post(
    "/jobs/{job_id}/tailor",
    response_model=TailoredResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def tailor_resume(
    job_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> TailoredResumeResponse:
    """Generate (and persist) a tailored resume for the given job.

    Validation order (each check short-circuits):
      1. Job ownership — 404 if missing or not owned (don't leak existence).
      2. No existing TailoredResume — 409 with `RESUME_ALREADY_EXISTS`.
      3. Profile readiness — 400 with `PROFILE_NOT_READY` if neither
         employment nor projects has at least one entry (PRD 3.4.A.2).
      4. AI quota / anti-abuse rate limit — stubbed; enforced in Phase 5.1.

    On AI failure: 502, no DB write, no credit consumed (failure is logged
    in `usage_log` with success=False).

    On success: TailoredResume row persisted with all snapshot fields frozen,
    `usage_log` row written, response returned. If the client has disconnected
    before we return, an in-app Notification is created so the user can find
    the result later.
    """
    # 1. Job ownership — 404 leaks no info about whether the job exists.
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    # 2. No existing TailoredResume for (user, job).
    existing = (
        db.query(TailoredResume)
        .filter(
            TailoredResume.user_id == current_user.id,
            TailoredResume.job_id == job.id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "A tailored resume already exists for this job.",
                "error_code": "RESUME_ALREADY_EXISTS",
                # Frontend loading screen redirects to the existing resume
                # editor on 409 — without this id it can only fall back to
                # the list page.
                "existing_resume_id": str(existing.id),
            },
        )

    # 3. Profile readiness check (PRD 3.4.A.2).
    profile = get_or_create_profile(current_user.id, db)
    if not _profile_is_ready(profile.profile_data or {}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": (
                    "Your profile must include at least one employment or "
                    "project entry before tailoring a resume."
                ),
                "error_code": "PROFILE_NOT_READY",
            },
        )

    # TODO(Phase 5.1): enforce AI quota here.
    # See docs/v2/tasks-monetization.json for the credit-consumption design.

    # TODO(Phase 5.1): enforce anti-abuse rate limiting here.
    # See docs/v2/tasks-monetization.json for the per-user/IP rate limit policy.

    # 4. Build job_data dict for the AI service.
    #    Field-name translation: Job stores `title`/`description_raw`; the AI
    #    service interface expects `job_title`/`description`.
    job_data = {
        "job_title": job.title,
        "company": job.company,
        "requirements": list(job.requirements or []),
        "description": job.description_raw or "",
    }

    # 5. Resolve preferences. `resume_preferences` is JSONB-loaded as a dict.
    preferences = dict(current_user.resume_preferences or {})

    # 6. Call the AI service. Per TAILOR-1 contract this NEVER raises —
    #    failures come back as `success=False` with empty `tailored_data`.
    try:
        result = await _ai_service.generate_tailored_resume(
            profile.profile_data or {},
            job_data,
            preferences,
        )
    except Exception as exc:  # pragma: no cover - defensive
        # TAILOR-1 promises no exceptions, but we still defend the endpoint.
        logger.error(
            "Unexpected AI exception during tailor for user %s: %s",
            current_user.id,
            exc,
        )
        _log_tailor_usage(db, current_user.id, success=False)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable. Please try again.",
        )

    if not result.success:
        logger.warning(
            "Tailor: AI returned unsuccessful result for user %s job %s",
            current_user.id,
            job.id,
        )
        _log_tailor_usage(db, current_user.id, success=False)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable. Please try again.",
        )

    # 7. Validate-then-clean the AI dict output through Pydantic so we get
    #    a fully-canonical, JSONB-safe payload before writing.
    try:
        validated = TailoredResumeGenerationResult.model_validate(
            {
                "tailored_data": result.tailored_data,
                "matched_keywords": result.matched_keywords,
                "applied_changes": result.applied_changes,
                "match_score": result.match_score,
            }
        )
        validated_dump = validated.model_dump(mode="json")
    except Exception as exc:
        logger.warning(
            "Tailor: AI output failed schema validation for user %s job %s: %s",
            current_user.id,
            job.id,
            exc,
        )
        _log_tailor_usage(db, current_user.id, success=False)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service returned an unexpected payload. Please try again.",
        )

    # 8. Build snapshot-aware row.
    sections_order = preferences.get("sections_order") or []
    font = preferences.get("font") or "Inter"
    template = preferences.get("template") or "classic"

    row = TailoredResume(
        user_id=current_user.id,
        job_id=job.id,
        name=_build_tailored_resume_name(job),
        # deep-copy the JSONB blob — SQLAlchemy doesn't track in-place dict
        # mutation on JSONB columns, and we want the snapshot decoupled
        # from any subsequent profile edits in this session.
        profile_snapshot=copy.deepcopy(profile.profile_data or {}),
        tailored_data=validated_dump["tailored_data"],
        matched_keywords=validated_dump["matched_keywords"],
        applied_changes=validated_dump["applied_changes"],
        match_score=validated_dump["match_score"],
        sections_order_snapshot=list(sections_order),
        font_snapshot=str(font),
        template_snapshot=str(template),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # 9. Audit success in usage_log (separate commit — see _log_tailor_usage).
    _log_tailor_usage(db, current_user.id, success=True, entity_id=row.id)

    logger.info(
        "Tailor complete for user %s job %s tailored_resume %s match_score=%d",
        current_user.id,
        job.id,
        row.id,
        row.match_score,
    )

    # 10. If the client has gone away, drop a notification so they can find
    #     the result. Failure to notify must NEVER break the response path.
    try:
        if await request.is_disconnected():
            try:
                title_str = (job.title or "your job").strip() or "your job"
                notif = Notification(
                    user_id=current_user.id,
                    type=NotificationType.RESUME_READY,
                    title="Tailored resume ready",
                    message=f"Your tailored resume for {title_str} is ready.",
                    entity_type="tailored_resume",
                    entity_id=row.id,
                )
                db.add(notif)
                db.commit()
                logger.info(
                    "Tailor: client disconnected; notification %s queued for user %s",
                    notif.id,
                    current_user.id,
                )
            except Exception as exc:
                logger.error(
                    "Tailor: failed to write disconnect-notification for user %s: %s",
                    current_user.id,
                    exc,
                )
                db.rollback()
    except Exception as exc:  # pragma: no cover - defensive
        # is_disconnected() itself shouldn't raise, but never let it sink us.
        logger.debug("is_disconnected() check failed: %s", exc)

    # Use the shared serializer so the response shape stays in lock-step with
    # the GET endpoints (and avoids the model_validate-on-relationship bug
    # documented inside `_serialize_tailored_resume`). At create time `rating`
    # is always None (the AIQualityRating row hasn't been written yet), but
    # routing through the helper keeps a single source of truth.
    return _serialize_tailored_resume(row)


@router.get(
    "/jobs/{job_id}/tailored-resume",
    response_model=TailoredResumeResponse,
    responses={204: {"description": "No tailored resume exists for this job."}},
)
def get_tailored_resume_for_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> Response | TailoredResumeResponse:
    """Look up an existing TailoredResume by Job id (TAILOR-16).

    Used by the Jobs list context menu to decide whether to show
    "View Resume" (a tailored resume already exists) or "Tailor Resume".

    Status semantics:
      - 200: TailoredResume exists → full `TailoredResumeResponse` shape,
        including joined `job_title` / `job_company` and `rating`.
      - 204: Job exists and is owned by the user, but has no TailoredResume.
      - 404: Job not found OR not owned by this user (don't leak existence —
        same pattern as `tailor_resume`, `_load_owned`).

    204 is intentionally distinct from 404: the frontend reads "no resume
    yet" from 204 and shows the "Tailor Resume" entry; 404 means "this
    isn't your job" and should never happen via the legitimate Jobs page.
    """
    # Ownership check first — 404 leaks no info about whether the job exists.
    # The (user_id, job_id) UNIQUE constraint guarantees at most one
    # tailored resume per (user, job), so once we know the user owns the
    # job we can safely look up by job_id alone.
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    # Eager-load the joined Job + AIQualityRating so `_serialize_tailored_resume`
    # can populate `job_title`, `job_company`, and `rating` without
    # extra queries. selectinload is fine here — single row, two trips.
    row = (
        db.query(TailoredResume)
        .options(
            selectinload(TailoredResume.job),
            selectinload(TailoredResume.rating),
        )
        .filter(TailoredResume.job_id == job_id)
        .first()
    )

    if row is None:
        logger.info(
            "Tailored-resume lookup miss: user_id=%s job_id=%s",
            current_user.id,
            job_id,
        )
        # 204 must have an empty body; explicit Response avoids FastAPI
        # serialising `None` into a JSON `null`.
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    logger.info(
        "Tailored-resume lookup hit: user_id=%s job_id=%s tailored_resume_id=%s",
        current_user.id,
        job_id,
        row.id,
    )
    return _serialize_tailored_resume(row)


# ---------------------------------------------------------------------------
# Cover Letter — generation (CL-2)
# ---------------------------------------------------------------------------


def _log_cl_usage(
    db: Session,
    user_id: UUID,
    success: bool,
    entity_id: Optional[UUID] = None,
) -> None:
    """Insert a `usage_log` audit row for a cover-letter generation attempt.

    Independent commit so an audit-glitch never blocks the user-facing
    response (mirrors `_log_tailor_usage`). On AI success this row backs
    the user's CL credit consumption; on failure (success=False) it is a
    diagnostic-only record and does NOT count against quota — the
    `_compute_usage` reducer in `app.services.usage_service` filters by
    `operation_type == 'generate_cover_letter'` and counts rows
    indiscriminately, so we only ever insert success=True rows here.
    """
    if not success:
        # Per CL-2 spec: failed AI calls do NOT consume credit. Skip the
        # audit row entirely; on failure we just log to the application
        # logger above.
        return
    try:
        log = UsageLog(
            user_id=user_id,
            operation_type="generate_cover_letter",
            cost_type="cl_credit",
            entity_type="job",
            entity_id=entity_id,
            success=True,
        )
        db.add(log)
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "Failed to write usage_log for user %s (generate_cover_letter): %s",
            user_id,
            exc,
        )
        db.rollback()


def _profile_data_for_cl(profile_data: dict | None) -> bool:
    """Readiness rule for cover letters.

    Mirrors PRD 3.4.A.2 (TAILOR profile readiness) — at minimum 1 employment
    OR 1 project. A cover letter without any work history would be the AI
    just hallucinating — better to surface PROFILE_NOT_READY upfront than
    burn a credit on garbage output.
    """
    if not profile_data:
        return False
    employment = profile_data.get("employment") or []
    projects = profile_data.get("projects") or []
    return len(employment) > 0 or len(projects) > 0


@router.post(
    "/jobs/{job_id}/cover-letter",
    response_model=CoverLetterGenerateResponse,
)
async def generate_cover_letter_for_job(
    job_id: UUID,
    payload: CoverLetterGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterGenerateResponse:
    """Generate 3 cover-letter variants for the given job (CL-2).

    Validation order (each check short-circuits on first failure):
      1. Job ownership — 404 if missing or not owned (no existence leak).
      2. No existing CoverLetter for (user, job) — 409 with structured
         `COVER_LETTER_ALREADY_EXISTS` body including the existing CL id
         so the frontend can deep-link "View Cover Letter".
      3. Profile readiness — 400 with `PROFILE_NOT_READY` if neither
         employment nor projects has at least one entry.
      4. If `source_type == 'tailored_resume'` — verify a TailoredResume
         exists for (user, job); 400 `TAILORED_RESUME_NOT_FOUND` if not.
      5. CL credit quota — STUB for MVP (Phase 5.1 lands the real check);
         shape returns 503 `OUT_OF_CL_QUOTA` with `reset_date` and
         `plan_slug` when implemented. For now this is a no-op.
      6. Anti-abuse rate limit — STUB for MVP (mirrors the tailor
         endpoint, which is also a stub today).

    On AI failure: 502, NO credit consumed, NO usage_log row written.
    On AI success: variants returned in-memory (NOT persisted), one CL
    credit consumed, usage_log row written, usage cache invalidated.

    Backgrounded behaviour (per CL-2 implementation_notes, option B):
    if the client disconnects mid-generation the variants are forfeit —
    the user must restart the wizard. This is intentional simplicity for
    MVP. CL-12 wires the disconnect detection: a Notification with
    `entity_type='cover_letter'` and `entity_id=NULL` is created so the
    frontend bell can route the user back to the wizard fresh-start
    (`/dashboard/cover-letters/generate`). The credit is still consumed
    (the AI work was done).
    """
    # 1. Job ownership — 404 leaks no info about whether the job exists.
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # 2. No existing CoverLetter for (user, job).
    existing_cl = (
        db.query(CoverLetter)
        .filter(
            CoverLetter.user_id == current_user.id,
            CoverLetter.job_id == job.id,
        )
        .first()
    )
    if existing_cl is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "A cover letter already exists for this job.",
                "error_code": "COVER_LETTER_ALREADY_EXISTS",
                # FE deep-links to the editor on 409 — without this id it
                # can only fall back to the list page.
                "existing_id": str(existing_cl.id),
            },
        )

    # 3. Profile readiness check.
    profile = get_or_create_profile(current_user.id, db)
    if not _profile_data_for_cl(profile.profile_data or {}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": (
                    "Your profile must include at least one employment or "
                    "project entry before generating a cover letter."
                ),
                "error_code": "PROFILE_NOT_READY",
            },
        )

    # 4. If sourcing from a tailored resume, verify it exists.
    tailored_resume_row: Optional[TailoredResume] = None
    if payload.source_type == "tailored_resume":
        tailored_resume_row = (
            db.query(TailoredResume)
            .filter(
                TailoredResume.user_id == current_user.id,
                TailoredResume.job_id == job.id,
            )
            .first()
        )
        if tailored_resume_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": (
                        "No tailored resume exists for this job. Generate a "
                        "tailored resume first or pick 'profile' as the source."
                    ),
                    "error_code": "TAILORED_RESUME_NOT_FOUND",
                },
            )

    # 5. CL credit quota — STUB for MVP.
    #    Phase 5.1 will read `cl_credits_used` / `cl_credits_limit` via
    #    `usage_service.get_usage` and raise:
    #        503 OUT_OF_CL_QUOTA — {error_code, reset_date, plan_slug}
    #    The wizard's `LimitReachedError` already handles this shape.

    # 6. Anti-abuse rate limit — STUB for MVP (mirrors `tailor_resume`).

    # 7. Build source_data based on source_type.
    if payload.source_type == "tailored_resume":
        # tailored_resume_row is guaranteed non-None by step 4.
        source_data: dict = dict(tailored_resume_row.tailored_data or {})
    else:
        source_data = dict(profile.profile_data or {})

    # 8. Build job_data — same shape as `tailor_resume`.
    job_data = {
        "job_title": job.title,
        "company": job.company,
        "requirements": list(job.requirements or []),
        "description": job.description_raw or "",
    }

    # 9. Build preferences for the AI service. Empty string for missing
    #    additional_context so the AI prompt template doesn't render `None`.
    preferences = {
        "source_type": payload.source_type,
        "style": payload.style,
        "tone": payload.tone,
        "length": payload.length,
        "additional_context": payload.additional_context or "",
    }

    # 10. Call the AI service. Per CL-1 contract, failures come back as
    #     `success=False` with empty variants. Defend against unexpected
    #     exceptions anyway.
    try:
        result = await _ai_service.generate_cover_letter(
            source_data,
            job_data,
            preferences,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "Unexpected AI exception during CL gen for user %s job %s: %s",
            current_user.id,
            job.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "detail": "AI service is temporarily unavailable. Please try again.",
                "error_code": "AI_GENERATION_FAILED",
            },
        )

    if not result.success or len(result.variants) != 3:
        # Per CL-1 contract, success=False means empty variants and no
        # usage. Also defensively reject malformed (non-3-variant) success.
        logger.warning(
            "CL gen: AI returned unsuccessful/malformed result for user %s job %s "
            "(success=%s, variants=%d)",
            current_user.id,
            job.id,
            result.success,
            len(result.variants),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "detail": "AI service is temporarily unavailable. Please try again.",
                "error_code": "AI_GENERATION_FAILED",
            },
        )

    # 11. Audit success in usage_log (separate commit). Credit consumed here.
    _log_cl_usage(db, current_user.id, success=True, entity_id=job.id)

    # 12. Invalidate the user's usage cache so the dashboard reflects the
    #     new credit count without waiting for the 5-minute TTL.
    try:
        await invalidate_usage_cache(str(current_user.id))
    except Exception as exc:  # pragma: no cover - defensive
        # Cache invalidation must never block a successful response.
        logger.debug("invalidate_usage_cache failed for CL gen: %s", exc)

    logger.info(
        "CL generation complete: user_id=%s job_id=%s source_type=%s variants=%d",
        current_user.id,
        job.id,
        payload.source_type,
        len(result.variants),
    )

    # 13. If the client has gone away, drop a notification so the user can
    #     find their way back. Per CL-2 implementation_notes (option B) the
    #     variants are NOT persisted, so `entity_id` stays NULL and the
    #     frontend bell routes to the wizard fresh-start (`/dashboard/
    #     cover-letters/generate`). The credit was already consumed above
    #     — accepted MVP trade-off per CL-12 spec. Failure to notify must
    #     NEVER break the response path (mirrors TAILOR-17).
    try:
        if await request.is_disconnected():
            try:
                title_str = (job.title or "your job").strip() or "your job"
                notif = Notification(
                    user_id=current_user.id,
                    type=NotificationType.COVER_LETTER_READY,
                    title="Cover letter is ready",
                    message=(
                        f"Your cover letter for {title_str} is ready — "
                        "click to review variants."
                    ),
                    entity_type="cover_letter",
                    # Variants weren't persisted (option B). FE routes to
                    # the wizard fresh-start when entity_id is null.
                    entity_id=None,
                )
                db.add(notif)
                db.commit()
                logger.info(
                    "CL gen: client disconnected post-AI; notification %s "
                    "queued for user %s job %s — variants forfeit per CL-2 option B.",
                    notif.id,
                    current_user.id,
                    job.id,
                )
            except Exception as exc:
                logger.error(
                    "CL gen: failed to write disconnect-notification for user %s: %s",
                    current_user.id,
                    exc,
                )
                db.rollback()
    except Exception as exc:  # pragma: no cover - defensive
        # is_disconnected() itself shouldn't raise, but never let it sink us.
        logger.debug("is_disconnected() check failed: %s", exc)

    return CoverLetterGenerateResponse(
        variants=[
            CoverLetterVariantResponse(content=v.content) for v in result.variants
        ],
    )


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

@router.patch("/applications/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    data: ApplicationStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ApplicationResponse:
    result = job_service.update_application_status(application_id, data.status, current_user, db)
    background_tasks.add_task(analytics_service.invalidate_analytics_cache, str(current_user.id))
    return result


@router.patch("/applications/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: UUID,
    data: ApplicationUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> ApplicationResponse:
    result = job_service.update_application(application_id, data, current_user, db)
    background_tasks.add_task(analytics_service.invalidate_analytics_cache, str(current_user.id))
    return result
