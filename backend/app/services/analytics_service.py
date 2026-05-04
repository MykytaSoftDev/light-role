from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.enums import ApplicationStatus, OperationType
from app.models.job import Job
from app.models.usage_log import UsageLog
from app.redis import get_redis_client
from app.schemas.analytics import (
    AIOperationCount,
    DataSufficiency,
    FunnelData,
    FunnelStage,
    HeroCounters,
    ResumePerformanceData,
    ResumeSparklinePoint,
    ResponseTimeData,
    StatusCount,
    TimelineMonth,
)

logger = logging.getLogger(__name__)

# Funnel stages in display order (ACCEPTED intentionally excluded from active funnel).
_FUNNEL_STAGES = [
    ApplicationStatus.SAVED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
]

_ACTIVE_STATUSES = {
    ApplicationStatus.SAVED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
}


# ---------------------------------------------------------------------------
# Period helper
# ---------------------------------------------------------------------------

def _period_start(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=7)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    return None  # "all"


def _prev_period_start(period: str) -> datetime | None:
    """Return the start of the equivalent period immediately before the current one."""
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=14)
    if period == "30d":
        return now - timedelta(days=60)
    if period == "90d":
        return now - timedelta(days=180)
    return None  # "all" — no previous period


# ---------------------------------------------------------------------------
# ANL-003 metric functions
# ---------------------------------------------------------------------------

def get_funnel(
    user_id: uuid.UUID,
    period: Literal["7d", "30d", "90d", "all"],
    db: Session,
) -> FunnelData:
    """Count applications per funnel stage, filtered by period (Job.created_at)."""
    start = _period_start(period)

    query = (
        db.query(Application.status, func.count(Application.id))
        .join(Job, Application.job_id == Job.id)
        .filter(Job.user_id == user_id)
    )
    if start is not None:
        query = query.filter(Job.created_at >= start)

    rows = query.group_by(Application.status).all()
    counts: dict[ApplicationStatus, int] = {row[0]: row[1] for row in rows}

    saved_count = counts.get(ApplicationStatus.SAVED, 0)

    stages: list[FunnelStage] = []
    prev_count: int | None = None

    for stage_status in _FUNNEL_STAGES:
        count = counts.get(stage_status, 0)
        pct_of_saved = round((count / saved_count * 100), 1) if saved_count > 0 else 0.0

        if prev_count is None:
            drop_off_pct = None
        else:
            drop_off_pct = round(((prev_count - count) / prev_count * 100), 1) if prev_count > 0 else 0.0

        stages.append(
            FunnelStage(
                stage=stage_status.value,
                count=count,
                pct_of_saved=pct_of_saved,
                drop_off_pct=drop_off_pct,
            )
        )
        prev_count = count

    return FunnelData(stages=stages, insight=None)


def get_applications_timeline(
    user_id: uuid.UUID,
    db: Session,
) -> list[TimelineMonth]:
    """Return application counts for the last 6 calendar months, zero-filled."""
    now = datetime.now(timezone.utc)

    # Build the list of expected months (last 6, newest last)
    months: list[str] = []
    for offset in range(5, -1, -1):
        # Go back `offset` months from the current month
        year = now.year
        month = now.month - offset
        while month <= 0:
            month += 12
            year -= 1
        months.append(f"{year:04d}-{month:02d}")

    rows = (
        db.query(
            func.to_char(func.date_trunc("month", Application.date_applied), "YYYY-MM").label("month"),
            func.count(Application.id).label("count"),
        )
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
            Application.date_applied >= text(
                f"date_trunc('month', now()) - INTERVAL '5 months'"
            ),
        )
        .group_by(text("1"))
        .all()
    )

    row_map: dict[str, int] = {row.month: row.count for row in rows}

    return [
        TimelineMonth(month=m, count=row_map.get(m, 0))
        for m in months
    ]


def get_status_breakdown(
    user_id: uuid.UUID,
    db: Session,
) -> list[StatusCount]:
    """Return counts for active application statuses (excludes terminal statuses)."""
    rows = (
        db.query(Application.status, func.count(Application.id))
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.status.in_(list(_ACTIVE_STATUSES)),
        )
        .group_by(Application.status)
        .all()
    )

    return [StatusCount(status=row[0].value, count=row[1]) for row in rows]


def get_resume_performance(
    user_id: uuid.UUID,
    db: Session,
) -> ResumePerformanceData:
    """
    Return performance stats for tailored resumes.

    NOTE (ARCH-1): The legacy Resume model has been removed. This endpoint
    returns an empty/null payload until Phase 4 reimplements it on top of
    the new `tailored_resumes` table (see PRD 6.6).
    """
    return ResumePerformanceData(
        avg_score=None,
        sparkline=[],
        best_resume_id=None,
        best_resume_name=None,
        best_score=None,
        worst_resume_id=None,
        worst_resume_name=None,
        worst_score=None,
        trend=None,
    )


def get_ai_operations_breakdown(
    user_id: uuid.UUID,
    db: Session,
) -> list[AIOperationCount]:
    """Return AI operation counts for the current calendar month."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rows = (
        db.query(UsageLog.operation_type, func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= month_start,
        )
        .group_by(UsageLog.operation_type)
        .all()
    )

    return [AIOperationCount(operation_type=row[0].value, count=row[1]) for row in rows]


def get_response_time(
    user_id: uuid.UUID,
    period: Literal["7d", "30d", "90d", "all"],
    db: Session,
) -> ResponseTimeData:
    """Return average days between date_applied and first_response_at."""
    start = _period_start(period)

    query = (
        db.query(
            func.avg(
                func.extract(
                    "epoch",
                    Application.first_response_at - Application.date_applied,
                )
                / 86400.0
            )
        )
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
            Application.first_response_at.isnot(None),
        )
    )
    if start is not None:
        query = query.filter(Application.date_applied >= start)

    avg_seconds = query.scalar()

    return ResponseTimeData(
        avg_days=round(float(avg_seconds), 1) if avg_seconds is not None else None,
    )


def _count_hero_metrics(
    user_id: uuid.UUID,
    db: Session,
    start: datetime | None,
    end: datetime | None,
) -> tuple[int, int, int, int]:
    """Return (jobs_saved, applied, interviews, offers) for a given time window."""
    query = (
        db.query(Application.status, func.count(Application.id))
        .join(Job, Application.job_id == Job.id)
        .filter(Job.user_id == user_id)
    )
    if start is not None:
        query = query.filter(Job.created_at >= start)
    if end is not None:
        query = query.filter(Job.created_at < end)

    rows = query.group_by(Application.status).all()
    counts: dict[ApplicationStatus, int] = {row[0]: row[1] for row in rows}

    jobs_saved = sum(counts.values())
    applied = counts.get(ApplicationStatus.APPLIED, 0)
    interviews = counts.get(ApplicationStatus.INTERVIEW, 0)
    offers = counts.get(ApplicationStatus.OFFER, 0)
    return jobs_saved, applied, interviews, offers


def get_hero_counters(
    user_id: uuid.UUID,
    period: Literal["7d", "30d", "90d", "all"],
    db: Session,
) -> HeroCounters:
    """Return hero counters with delta vs previous equivalent period."""
    current_start = _period_start(period)
    prev_start = _prev_period_start(period)

    curr = _count_hero_metrics(user_id, db, current_start, None)

    if period == "all":
        prev = (0, 0, 0, 0)
    else:
        prev = _count_hero_metrics(user_id, db, prev_start, current_start)

    return HeroCounters(
        jobs_saved=curr[0],
        applied=curr[1],
        interviews=curr[2],
        offers=curr[3],
        jobs_saved_delta=curr[0] - prev[0],
        applied_delta=curr[1] - prev[1],
        interviews_delta=curr[2] - prev[2],
        offers_delta=curr[3] - prev[3],
    )


def get_data_sufficiency(
    user_id: uuid.UUID,
    db: Session,
) -> DataSufficiency:
    """Return data sufficiency indicators."""
    total_jobs: int = (
        db.query(func.count(Job.id))
        .filter(Job.user_id == user_id)
        .scalar()
    ) or 0

    total_applications: int = (
        db.query(func.count(Application.id))
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.status != ApplicationStatus.SAVED,
        )
        .scalar()
    ) or 0

    # NOTE (ARCH-1): scored-resume count temporarily reports 0 until the new
    # tailored_resumes pipeline is wired up in Phase 4.
    total_scored_resumes: int = 0

    return DataSufficiency(
        total_jobs=total_jobs,
        total_applications=total_applications,
        total_scored_resumes=total_scored_resumes,
        threshold_jobs=5,
        threshold_applications=5,
        threshold_scored_resumes=3,
        has_sufficient_data=total_applications >= 5,
    )


# ---------------------------------------------------------------------------
# ANL-006: Cache helpers
# ---------------------------------------------------------------------------

async def invalidate_analytics_cache(user_id: str) -> None:
    """Delete all cached analytics entries for a user across all versions/periods."""
    try:
        client = await get_redis_client()
        pattern = f"analytics:v*:{user_id}:*"
        async for key in client.scan_iter(pattern):
            await client.delete(key)
        logger.debug(f"Analytics cache invalidated for user_id={user_id}")
    except Exception as exc:
        logger.warning(f"Analytics cache invalidation error for user_id={user_id}: {exc}")
