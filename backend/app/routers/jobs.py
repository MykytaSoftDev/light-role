from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.openai_service import OpenAIService
from app.database import get_db
from app.dependencies.ai_limit import require_ai_quota
from app.dependencies.auth import get_verified_user
from app.models.application import Application
from app.models.enums import ApplicationStatus, OperationType
from app.models.job import Job
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import increment_usage_count
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
from app.services import analytics_service, job_service
from app.services.ai_usage_service import log_ai_operation
from app.services.subscription_service import get_effective_plan

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

    if result.success and result.usage is not None:
        try:
            log_ai_operation(
                db=db,
                user_id=current_user.id,
                operation_type=OperationType.JOB_PARSE,
                usage=result.usage,
            )
        except Exception as exc:
            logger.error("Failed to log AI usage for user %s: %s", current_user.id, exc)

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
