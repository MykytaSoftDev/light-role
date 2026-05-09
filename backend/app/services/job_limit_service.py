"""Active-jobs limit enforcement (MONETIZE-4).

Reads ``plan.max_active_jobs`` from the user's effective plan and counts
non-terminal applications. Used by both ``POST /jobs`` and
``POST /jobs/parse`` (job creation entry points). Not implemented as a
FastAPI dependency because the limit is tied to creation only — moves
between non-terminal statuses don't need re-checking.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.services.subscription_service import get_effective_plan

logger = logging.getLogger(__name__)

_TERMINAL_STATUSES = (
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
)


def _resolve_active_jobs_cap(db: Session, subscription: Subscription | None) -> int | None:
    """Return ``max_active_jobs`` for the user's effective plan.

    ``None`` means unlimited. Past-due grace is honoured: if the
    effective plan slug differs from the attached plan slug, we
    re-resolve the FREE plan from the DB and use its column.
    """
    plan: Plan | None = subscription.plan if subscription else None
    effective_slug = get_effective_plan(subscription)

    if plan is not None and effective_slug != plan.code:
        plan = db.query(Plan).filter(Plan.code == effective_slug).first()
    elif plan is None:
        plan = db.query(Plan).filter(Plan.code == "free").first()

    if plan is None:
        # Conservative fallback — block rather than grant unlimited.
        logger.error(
            "_resolve_active_jobs_cap: no plan row for slug %s — "
            "applying cap=0 as a safety fallback.",
            effective_slug,
        )
        return 0

    return plan.max_active_jobs


def check_active_jobs_limit(user: User, db: Session) -> None:
    """Raise HTTP 402 ``ACTIVE_JOBS_EXCEEDED`` if the user is at or over their cap.

    Active = job has an Application whose status is NOT terminal
    (accepted / rejected / withdrawn). Plans with ``max_active_jobs IS NULL``
    are unlimited and skip the check.

    Counts via JOIN on ``applications`` so jobs without an Application row
    (shouldn't happen — created in same transaction — but defensive) are
    excluded from the count just like terminal-status jobs.
    """
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .first()
    )

    cap = _resolve_active_jobs_cap(db, subscription)
    # NULL = unlimited.
    if cap is None:
        return

    active_count = (
        db.query(func.count(Job.id))
        .join(Application, Application.job_id == Job.id)
        .filter(
            Job.user_id == user.id,
            Application.status.notin_(_TERMINAL_STATUSES),
        )
        .scalar()
    ) or 0

    if active_count >= cap:
        effective_slug = get_effective_plan(subscription)
        logger.warning(
            "Active-jobs cap reached: user_id=%s plan=%s active=%d cap=%d",
            user.id,
            effective_slug,
            active_count,
            cap,
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error_code": "ACTIVE_JOBS_EXCEEDED",
                "current_count": active_count,
                "plan_limit": cap,
                "plan_code": effective_slug,
                "upgrade_url": "/dashboard/upgrade",
            },
        )
