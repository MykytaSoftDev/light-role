from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.job import ApplicationUpdate, JobCreate, JobUpdate

logger = logging.getLogger(__name__)

_SORTABLE_JOB_COLUMNS = {
    "title": Job.title,
    "company": Job.company,
    "created_at": Job.created_at,
    "date_applied": Application.date_applied,
}


def create_job(data: JobCreate, user: User, db: Session) -> Job:
    """Create a Job and its linked Application (status=SAVED) atomically."""
    job = Job(
        user_id=user.id,
        title=data.title,
        company=data.company,
        description_raw=data.description_raw,
        requirements=data.requirements,
        location=data.location,
        salary=data.salary,
        is_ai_parsed=False,
    )
    db.add(job)
    db.flush()  # populate job.id before creating the application

    application = Application(
        job_id=job.id,
        status=ApplicationStatus.SAVED,
    )
    db.add(application)
    db.commit()
    db.refresh(job)

    logger.info(f"Job created: job_id={job.id} user_id={user.id}")
    return job


def get_jobs(
    user: User,
    db: Session,
    *,
    status: Optional[ApplicationStatus] = None,
    company: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Job], int]:
    """Return a paginated, filtered, sorted list of the user's jobs."""
    query = (
        db.query(Job)
        .options(joinedload(Job.application))
        .join(Application, Job.application)
        .filter(Job.user_id == user.id)
    )

    if status is not None:
        query = query.filter(Application.status == status)

    if company is not None:
        query = query.filter(Job.company.ilike(f"%{company}%"))

    if date_from is not None:
        query = query.filter(Job.created_at >= date_from)

    if date_to is not None:
        query = query.filter(Job.created_at <= date_to)

    total: int = query.count()

    sort_column = _SORTABLE_JOB_COLUMNS.get(sort_by, Job.created_at)
    order_fn = desc if sort_order.lower() == "desc" else asc
    query = query.order_by(order_fn(sort_column))

    jobs = query.limit(limit).offset(offset).all()
    return jobs, total


def get_job(job_id: UUID, user: User, db: Session) -> Job:
    """Return a single job, 404 if not found or not owned by this user."""
    job = (
        db.query(Job)
        .options(
            joinedload(Job.application),
            joinedload(Job.cover_letters),
        )
        .filter(Job.id == job_id, Job.user_id == user.id)
        .first()
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job


def update_job(job_id: UUID, data: JobUpdate, user: User, db: Session) -> Job:
    """Partially update a job's fields."""
    job = get_job(job_id, user, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    logger.info(f"Job updated: job_id={job_id} user_id={user.id} fields={list(update_data.keys())}")
    return job


def delete_job(job_id: UUID, user: User, db: Session) -> None:
    """Delete a job (cascade removes the linked application)."""
    job = get_job(job_id, user, db)
    db.delete(job)
    db.commit()
    logger.info(f"Job deleted: job_id={job_id} user_id={user.id}")


# ---------------------------------------------------------------------------
# Application helpers
# ---------------------------------------------------------------------------

def _get_application(app_id: UUID, user: User, db: Session) -> Application:
    """Return an application owned by this user, 404 otherwise."""
    application = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.id == app_id, Job.user_id == user.id)
        .first()
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return application


def get_application_by_id(app_id: UUID, user: User, db: Session) -> Application:
    return _get_application(app_id, user, db)


_RESPONSE_TRIGGER_STATUSES = {
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
}


def update_application_status(
    app_id: UUID,
    new_status: ApplicationStatus,
    user: User,
    db: Session,
) -> Application:
    application = _get_application(app_id, user, db)

    # Populate first_response_at when transitioning from 'applied' to a response
    # status, but only if a date_applied is set and the field is not yet filled.
    if (
        application.status == ApplicationStatus.APPLIED
        and new_status in _RESPONSE_TRIGGER_STATUSES
        and application.date_applied is not None
        and application.first_response_at is None
    ):
        application.first_response_at = datetime.now(timezone.utc)

    application.status = new_status
    db.commit()
    db.refresh(application)
    logger.info(f"Application status updated: app_id={app_id} status={new_status} user_id={user.id}")
    return application


def update_application(
    app_id: UUID,
    data: ApplicationUpdate,
    user: User,
    db: Session,
) -> Application:
    application = _get_application(app_id, user, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    logger.info(f"Application updated: app_id={app_id} user_id={user.id} fields={list(update_data.keys())}")
    return application
