from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from typing import Literal

from sqlalchemy import case, func, text
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.application_status_history import ApplicationStatusHistory
from app.models.cover_letter import CoverLetter
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.models.tailored_resume import TailoredResume
from app.models.usage_log import UsageLog
from app.redis import get_redis_client
from app.schemas.analytics import (
    ActivityEvent,
    ActivityEventType,
    AIOperationCount,
    AnalyticsResponse,
    DailyActivity,
    DataSufficiency,
    FunnelData,
    FunnelStage as FunnelStageNew,
    FunnelStageLegacy as FunnelStage,
    GenerationBucket,
    HeroCounters,
    KpiMetric,
    PersonalBest,
    Period,
    ResumePerformanceData,
    ResumeSparklinePoint,
    ResponseTimeData,
    StatusCount,
    TimelineBucket,
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

    return [AIOperationCount(operation_type=row[0], count=row[1]) for row in rows]


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

    total_scored_resumes: int = (
        db.query(func.count(TailoredResume.id))
        .filter(TailoredResume.user_id == user_id)
        .scalar()
    ) or 0

    return DataSufficiency(
        total_jobs=total_jobs,
        total_applications=total_applications,
        total_scored_resumes=total_scored_resumes,
        threshold_jobs=5,
        threshold_applications=5,
        threshold_scored_resumes=3,
        has_sufficient_data=total_applications >= 5,
    )


# ===========================================================================
# Analytics redesign — Phase 2 (SPEC-analytics-redesign.md §4.1–§4.8)
#
# New computation functions feeding the rewritten ``AnalyticsResponse``.
# The legacy functions above are intentionally retained until Phase 10.5
# cleanup so that the pre-redesign endpoint keeps working.
# ===========================================================================


# Status values that count as "having reached the applied stage" for the
# cumulative funnel (SPEC §4.4) and KPI sparkline (SPEC §4.6).
_REACHED_APPLIED = (
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
)
_REACHED_SCREENING = (
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
)
_REACHED_INTERVIEW = (
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
)
_REACHED_OFFER = (
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
)


# Operation type strings written to ``usage_log.operation_type`` (PRD 6.12 / ARCH-9).
_OP_TAILOR_RESUME = "tailor_resume"
_OP_GENERATE_CL = "generate_cover_letter"
_GENERATION_OPS = (_OP_TAILOR_RESUME, _OP_GENERATE_CL)


# Status transitions that emit an activity-feed event. The synthetic
# ``job_saved`` event covers initial saves; ``status_change_saved`` and
# transitions to terminal states (accepted / withdrawn) intentionally
# do not surface.
_FEED_STATUS_TRANSITIONS = {
    ApplicationStatus.APPLIED: "status_change_applied",
    ApplicationStatus.SCREENING: "status_change_screening",
    ApplicationStatus.INTERVIEW: "status_change_interview",
    ApplicationStatus.OFFER: "status_change_offer",
    ApplicationStatus.REJECTED: "status_change_rejected",
}

# Russian human-readable status names for activity feed titles + meta.
_STATUS_RU = {
    ApplicationStatus.APPLIED: "отклик",
    ApplicationStatus.SCREENING: "скрининг",
    ApplicationStatus.INTERVIEW: "интервью",
    ApplicationStatus.OFFER: "оффер",
    ApplicationStatus.REJECTED: "отказ",
}

# Status transition titles. Each is the verb phrase before the
# `· <strong>{company}</strong> — {role}` tail rendered downstream.
_STATUS_TITLE_VERB = {
    ApplicationStatus.APPLIED: "Отправил отклик",
    ApplicationStatus.SCREENING: "Прошёл в скрининг",
    ApplicationStatus.INTERVIEW: "Назначено интервью",
    ApplicationStatus.OFFER: "Получил оффер",
    ApplicationStatus.REJECTED: "Получил отказ",
}


# ---------------------------------------------------------------------------
# Period / granularity helpers
# ---------------------------------------------------------------------------


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _today_utc() -> date:
    return _utc_now().date()


def _period_window(period: Period, anchor: datetime | None = None) -> tuple[datetime, datetime]:
    """Return ``[start, end)`` UTC-naive bounds for the requested period.

    ``end`` is the moment the analytics snapshot is taken (now). ``start``
    is computed relative to that anchor. The bounds are inclusive on the
    start side, exclusive on the end side, matching SPEC §4.1 SQL.

    For ``all`` the start is a sentinel epoch — callers should treat
    ``period == 'all'`` specially when they need an actual lower bound
    (e.g. they should fall back to the user's earliest application).
    """
    end = (anchor or _utc_now()).replace(tzinfo=None)
    if period == "7d":
        start = end - timedelta(days=7)
    elif period == "30d":
        start = end - timedelta(days=30)
    elif period == "90d":
        start = end - timedelta(days=90)
    else:  # all
        start = datetime(1970, 1, 1)
    return start, end


def _previous_period_window(
    period: Period, anchor: datetime | None = None
) -> tuple[datetime, datetime] | None:
    """Return ``[prev_start, prev_end)`` immediately preceding the current period.

    Returns ``None`` for ``period == 'all'`` (no previous comparison).
    """
    if period == "all":
        return None
    end = (anchor or _utc_now()).replace(tzinfo=None)
    if period == "7d":
        delta = timedelta(days=7)
    elif period == "30d":
        delta = timedelta(days=30)
    else:  # 90d
        delta = timedelta(days=90)
    return end - 2 * delta, end - delta


def _granularity(period: Period) -> Literal["day", "week", "month"]:
    if period in ("7d", "30d"):
        return "day"
    if period == "90d":
        return "week"
    return "month"


def _expected_buckets(
    period: Period,
    start: datetime,
    end: datetime,
    earliest: date | None = None,
) -> list[date]:
    """Return the ordered list of bucket-start dates for the period.

    The granularity rules (SPEC §4.1):
      * ``7d`` -> 7 daily buckets ending today
      * ``30d`` -> 30 daily buckets ending today
      * ``90d`` -> 13 ISO-week buckets (Monday-anchored)
      * ``all`` -> monthly buckets from the user's earliest application
        (or the current month if there are none) through the current month
    """
    today = end.date()
    if period == "7d":
        return [today - timedelta(days=i) for i in range(6, -1, -1)]
    if period == "30d":
        return [today - timedelta(days=i) for i in range(29, -1, -1)]
    if period == "90d":
        # Anchor on Monday of the ISO week containing ``today``, then walk
        # back 12 weeks for a total of 13 points.
        end_week_start = today - timedelta(days=today.weekday())
        return [end_week_start - timedelta(weeks=i) for i in range(12, -1, -1)]
    # all -> monthly
    if earliest is None:
        earliest = today.replace(day=1)
    first = earliest.replace(day=1)
    cur_month_start = today.replace(day=1)
    months: list[date] = []
    cursor = first
    while cursor <= cur_month_start:
        months.append(cursor)
        # Advance one calendar month.
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)
    return months


def _bucket_key_for(d: date, granularity: Literal["day", "week", "month"]) -> date:
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    return d.replace(day=1)


# ---------------------------------------------------------------------------
# 2.1 Applications timeline
# ---------------------------------------------------------------------------


def _query_applications_in_window(
    user_id: uuid.UUID,
    start: datetime,
    end: datetime,
    db: Session,
) -> list[date]:
    """Return ``date_applied`` (as date) for every application of the user
    whose ``date_applied`` falls in ``[start, end)``."""
    rows = (
        db.query(func.date(Application.date_applied))
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
            Application.date_applied >= start,
            Application.date_applied < end,
        )
        .all()
    )
    return [row[0] for row in rows]


def _bucket_dates(
    dates: list[date],
    expected: list[date],
    granularity: Literal["day", "week", "month"],
) -> list[TimelineBucket]:
    """Aggregate raw dates into the expected bucket array (zero-filled)."""
    counts: dict[date, int] = defaultdict(int)
    for d in dates:
        counts[_bucket_key_for(d, granularity)] += 1
    return [TimelineBucket(date=b, count=counts.get(b, 0)) for b in expected]


def _compute_applications_timeline(
    user_id: uuid.UUID,
    period: Period,
    db: Session,
) -> tuple[list[TimelineBucket], list[TimelineBucket]]:
    """Return ``(current_buckets, previous_buckets)`` per SPEC §4.1.

    For ``period == 'all'`` the previous period is empty.
    """
    end_now = _utc_now()
    start, end = _period_window(period, end_now)
    granularity = _granularity(period)

    earliest_for_all: date | None = None
    if period == "all":
        earliest_for_all = (
            db.query(func.min(func.date(Application.created_at)))
            .join(Job, Application.job_id == Job.id)
            .filter(Job.user_id == user_id)
            .scalar()
        )
        # If the user has zero applications, just show the current month.
        if earliest_for_all is None:
            earliest_for_all = end.date().replace(day=1)
        # Use the user's earliest application as the lower bound for the
        # SQL query as well — the 1970 sentinel works but reading less is
        # cheaper.
        start = datetime.combine(earliest_for_all.replace(day=1), datetime.min.time())

    expected = _expected_buckets(period, start, end, earliest=earliest_for_all)
    current_dates = _query_applications_in_window(user_id, start, end, db)
    current_buckets = _bucket_dates(current_dates, expected, granularity)

    if period == "all":
        return current_buckets, []

    prev_window = _previous_period_window(period, end_now)
    assert prev_window is not None  # narrowed by the period == "all" check above
    prev_start, prev_end = prev_window
    # The previous window's expected buckets shift back by exactly the
    # period length, preserving the granularity.
    period_len_days = (end - start).days
    prev_expected = [b - timedelta(days=period_len_days) for b in expected]
    prev_dates = _query_applications_in_window(user_id, prev_start, prev_end, db)
    previous_buckets = _bucket_dates(prev_dates, prev_expected, granularity)

    return current_buckets, previous_buckets


# ---------------------------------------------------------------------------
# 2.2 Daily activity + streak
# ---------------------------------------------------------------------------


def _compute_daily_activity(
    user_id: uuid.UUID,
    db: Session,
    days: int = 91,
) -> list[DailyActivity]:
    """Return per-day application counts for the last ``days`` days.

    Period-independent: callers should always request 91 days (the
    heatmap span) regardless of the page-level period selector so the
    streak and personal-best computations stay stable when the user
    flips the tabs (SPEC §4.2 / §4.3).
    """
    today = _today_utc()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, datetime.min.time())

    rows = (
        db.query(
            func.date(Application.date_applied).label("d"),
            func.count(Application.id).label("c"),
        )
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
            Application.date_applied >= start_dt,
        )
        .group_by(text("1"))
        .all()
    )
    counts: dict[date, int] = {row.d: row.c for row in rows}
    return [
        DailyActivity(date=start + timedelta(days=i), count=counts.get(start + timedelta(days=i), 0))
        for i in range(days)
    ]


def _compute_streak(
    daily_activity: list[DailyActivity],
    all_time_history: list[DailyActivity],
) -> tuple[int, int]:
    """Return ``(current_streak_days, longest_streak_days)`` (SPEC §4.2).

    ``daily_activity`` powers the *current* streak (consecutive days
    ending today, or yesterday if today has no activity yet).
    ``all_time_history`` is scanned to find the longest streak ever.
    Returns ``(0, 0)`` if the user has no applications at all.
    """
    if not all_time_history or all(d.count == 0 for d in all_time_history):
        return 0, 0

    # --- Current streak ---------------------------------------------------
    by_date = {d.date: d.count for d in daily_activity}
    today = _today_utc()
    cursor = today
    if by_date.get(today, 0) == 0:
        # No activity today yet — allow yesterday as the streak start so
        # users don't lose the badge mid-day.
        cursor = today - timedelta(days=1)
    current = 0
    while by_date.get(cursor, 0) > 0:
        current += 1
        cursor -= timedelta(days=1)

    # --- Longest streak ---------------------------------------------------
    # ``all_time_history`` is zero-filled day-by-day, so a non-zero day
    # always extends the previous run if and only if the previous day was
    # also non-zero. Reset on any zero-count day.
    sorted_days = sorted(all_time_history, key=lambda d: d.date)
    longest = 0
    run = 0
    for entry in sorted_days:
        if entry.count > 0:
            run += 1
            longest = max(longest, run)
        else:
            run = 0

    return current, longest


def _query_all_time_daily_activity(
    user_id: uuid.UUID,
    db: Session,
) -> list[DailyActivity]:
    """Return one DailyActivity entry per day from the user's first
    application date through today (zero-filled)."""
    earliest = (
        db.query(func.min(func.date(Application.date_applied)))
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
        )
        .scalar()
    )
    if earliest is None:
        return []

    today = _today_utc()
    rows = (
        db.query(
            func.date(Application.date_applied).label("d"),
            func.count(Application.id).label("c"),
        )
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            Application.date_applied.isnot(None),
        )
        .group_by(text("1"))
        .all()
    )
    counts = {row.d: row.c for row in rows}
    span = (today - earliest).days + 1
    return [
        DailyActivity(date=earliest + timedelta(days=i), count=counts.get(earliest + timedelta(days=i), 0))
        for i in range(span)
    ]


# ---------------------------------------------------------------------------
# 2.3 Personal best
# ---------------------------------------------------------------------------


def _compute_personal_best(
    user_id: uuid.UUID,
    db: Session,
    history: list[DailyActivity] | None = None,
) -> PersonalBest | None:
    """Return the best 7-day window of applications (SPEC §4.3).

    Returns ``None`` if total all-time applications < 3. If the user's
    history is shorter than 7 days, falls back to the actual best span
    available rather than padding with zero-count days.
    """
    if history is None:
        history = _query_all_time_daily_activity(user_id, db)
    total = sum(d.count for d in history)
    if total < 3 or not history:
        return None

    # Sort by date — _query_all_time_daily_activity already does, but be
    # defensive when callers pass their own slice.
    history = sorted(history, key=lambda d: d.date)
    n = len(history)
    window = min(7, n)

    best_count = -1
    best_start = 0
    for i in range(0, n - window + 1):
        s = sum(d.count for d in history[i : i + window])
        if s > best_count:
            best_count = s
            best_start = i

    start = history[best_start].date
    end = history[best_start + window - 1].date
    return PersonalBest(
        start_date=start,
        end_date=end,
        count=best_count,
        metric="applications",
    )


# ---------------------------------------------------------------------------
# 2.4 KPI metrics with sparklines
# ---------------------------------------------------------------------------


def _count_in_window(
    user_id: uuid.UUID,
    db: Session,
    column,
    start: datetime,
    end: datetime,
) -> int:
    """Count applications belonging to the user where ``column`` is in
    ``[start, end)``. ``column`` is an Application column (e.g.
    ``Application.created_at`` or ``Application.date_applied``)."""
    return (
        db.query(func.count(Application.id))
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.user_id == user_id,
            column.isnot(None),
            column >= start,
            column < end,
        )
        .scalar()
    ) or 0


def _count_reached_in_window(
    user_id: uuid.UUID,
    db: Session,
    statuses: tuple[ApplicationStatus, ...],
    start: datetime,
    end: datetime,
) -> int:
    """Count distinct applications that transitioned to one of ``statuses``
    during ``[start, end)``. Source: ``application_status_history``."""
    return (
        db.query(func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .filter(
            ApplicationStatusHistory.user_id == user_id,
            ApplicationStatusHistory.to_status.in_(statuses),
            ApplicationStatusHistory.from_status.isnot(None),
            ApplicationStatusHistory.created_at >= start,
            ApplicationStatusHistory.created_at < end,
        )
        .scalar()
    ) or 0


def _sparkline_for_dates(timestamps: list[date], today: date) -> list[int]:
    """Build a 7-element cumulative sparkline.

    For each of the last 7 days (oldest first, today last), count how
    many timestamps fall on or before that day. The result is
    monotonically non-decreasing so the chart stroke always trends up
    or flat.
    """
    sorted_dates = sorted(timestamps)
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    out: list[int] = []
    j = 0
    n = len(sorted_dates)
    for d in days:
        while j < n and sorted_dates[j] <= d:
            j += 1
        out.append(j)
    return out


def _kpi_metric(
    current: int,
    previous: int,
    sparkline_dates: list[date],
    today: date,
) -> KpiMetric:
    return KpiMetric(
        current=current,
        delta=current - previous,
        sparkline=_sparkline_for_dates(sparkline_dates, today),
    )


def _compute_kpi_metrics(
    user_id: uuid.UUID,
    period: Period,
    db: Session,
) -> dict[str, KpiMetric]:
    """Return the four KPI cards (saved / applied / interviews / offers).

    SPEC §4.6 — sparklines are *cumulative* counts over the last 7 days
    so the line always trends up. Counts:

      * ``jobs_saved`` — applications created in the period (every
        application starts as saved, so every row counts).
      * ``applied`` — applications whose ``date_applied`` falls in the
        period (matches the timeline definition above for consistency).
      * ``interviews`` — distinct applications that *reached* interview
        (or further) during the period via ``application_status_history``.
      * ``offers`` — same approach for ``offer`` / ``accepted``.
    """
    end_now = _utc_now()
    start, end = _period_window(period, end_now)
    prev = _previous_period_window(period, end_now)
    today = end_now.date()
    sparkline_window_start = datetime.combine(today - timedelta(days=6), datetime.min.time())

    # --- Current period counts ------------------------------------------------
    jobs_saved_curr = _count_in_window(user_id, db, Application.created_at, start, end)
    applied_curr = _count_in_window(user_id, db, Application.date_applied, start, end)
    interviews_curr = _count_reached_in_window(user_id, db, _REACHED_INTERVIEW, start, end)
    offers_curr = _count_reached_in_window(user_id, db, _REACHED_OFFER, start, end)

    # --- Previous period counts (zero for "all") -----------------------------
    if prev is None:
        jobs_saved_prev = applied_prev = interviews_prev = offers_prev = 0
    else:
        ps, pe = prev
        jobs_saved_prev = _count_in_window(user_id, db, Application.created_at, ps, pe)
        applied_prev = _count_in_window(user_id, db, Application.date_applied, ps, pe)
        interviews_prev = _count_reached_in_window(user_id, db, _REACHED_INTERVIEW, ps, pe)
        offers_prev = _count_reached_in_window(user_id, db, _REACHED_OFFER, ps, pe)

    # --- Sparkline source dates (last 7 days) --------------------------------
    saved_dates = [
        row[0]
        for row in (
            db.query(func.date(Application.created_at))
            .join(Job, Application.job_id == Job.id)
            .filter(
                Job.user_id == user_id,
                Application.created_at >= sparkline_window_start,
            )
            .all()
        )
    ]
    applied_dates = [
        row[0]
        for row in (
            db.query(func.date(Application.date_applied))
            .join(Job, Application.job_id == Job.id)
            .filter(
                Job.user_id == user_id,
                Application.date_applied.isnot(None),
                Application.date_applied >= sparkline_window_start,
            )
            .all()
        )
    ]
    interview_dates = [
        row[0]
        for row in (
            db.query(func.date(ApplicationStatusHistory.created_at))
            .filter(
                ApplicationStatusHistory.user_id == user_id,
                ApplicationStatusHistory.to_status.in_(_REACHED_INTERVIEW),
                ApplicationStatusHistory.from_status.isnot(None),
                ApplicationStatusHistory.created_at >= sparkline_window_start,
            )
            .all()
        )
    ]
    offer_dates = [
        row[0]
        for row in (
            db.query(func.date(ApplicationStatusHistory.created_at))
            .filter(
                ApplicationStatusHistory.user_id == user_id,
                ApplicationStatusHistory.to_status.in_(_REACHED_OFFER),
                ApplicationStatusHistory.from_status.isnot(None),
                ApplicationStatusHistory.created_at >= sparkline_window_start,
            )
            .all()
        )
    ]

    return {
        "jobs_saved": _kpi_metric(jobs_saved_curr, jobs_saved_prev, saved_dates, today),
        "applied": _kpi_metric(applied_curr, applied_prev, applied_dates, today),
        "interviews": _kpi_metric(interviews_curr, interviews_prev, interview_dates, today),
        "offers": _kpi_metric(offers_curr, offers_prev, offer_dates, today),
    }


# ---------------------------------------------------------------------------
# 2.5 Funnel (cumulative)
# ---------------------------------------------------------------------------


def _compute_funnel(
    user_id: uuid.UUID,
    period: Period,
    db: Session,
) -> list[FunnelStageNew]:
    """Return the cumulative funnel for applications created in the period.

    SPEC §4.4 — ``interview.count`` includes every application that ever
    reached interview, even if it has since moved to offer or rejected.
    This is computed by EXISTS-checking each stage against
    ``application_status_history``, scoping the application set to those
    *created* in the period (matching the SPEC SQL example).
    """
    start, end = _period_window(period, _utc_now())

    if period == "all":
        # Use a wide-open lower bound so we don't accidentally drop pre-1970
        # data; in practice this matches all of the user's applications.
        applications_q = (
            db.query(Application.id)
            .join(Job, Application.job_id == Job.id)
            .filter(Job.user_id == user_id)
        )
    else:
        applications_q = (
            db.query(Application.id)
            .join(Job, Application.job_id == Job.id)
            .filter(
                Job.user_id == user_id,
                Application.created_at >= start,
                Application.created_at < end,
            )
        )

    application_ids = [row.id for row in applications_q.all()]
    saved_count = len(application_ids)

    if saved_count == 0:
        return [
            FunnelStageNew(stage="saved", count=0, percentage_of_top=0.0),
            FunnelStageNew(stage="applied", count=0, percentage_of_top=0.0),
            FunnelStageNew(stage="screening", count=0, percentage_of_top=0.0),
            FunnelStageNew(stage="interview", count=0, percentage_of_top=0.0),
            FunnelStageNew(stage="offer", count=0, percentage_of_top=0.0),
        ]

    # One aggregation pass: which applications ever reached each stage?
    # ``case`` columns are 1 if the row's to_status is in the target set.
    rows = (
        db.query(
            ApplicationStatusHistory.application_id,
            func.max(
                case(
                    (ApplicationStatusHistory.to_status.in_(_REACHED_APPLIED), 1),
                    else_=0,
                )
            ).label("applied"),
            func.max(
                case(
                    (ApplicationStatusHistory.to_status.in_(_REACHED_SCREENING), 1),
                    else_=0,
                )
            ).label("screening"),
            func.max(
                case(
                    (ApplicationStatusHistory.to_status.in_(_REACHED_INTERVIEW), 1),
                    else_=0,
                )
            ).label("interview"),
            func.max(
                case(
                    (ApplicationStatusHistory.to_status.in_(_REACHED_OFFER), 1),
                    else_=0,
                )
            ).label("offer"),
        )
        .filter(
            ApplicationStatusHistory.user_id == user_id,
            ApplicationStatusHistory.application_id.in_(application_ids),
        )
        .group_by(ApplicationStatusHistory.application_id)
        .all()
    )

    applied = sum(1 for r in rows if r.applied)
    screening = sum(1 for r in rows if r.screening)
    interview = sum(1 for r in rows if r.interview)
    offer = sum(1 for r in rows if r.offer)

    def _pct(c: int) -> float:
        return round((c / saved_count) * 100, 1) if saved_count > 0 else 0.0

    return [
        FunnelStageNew(stage="saved", count=saved_count, percentage_of_top=100.0),
        FunnelStageNew(stage="applied", count=applied, percentage_of_top=_pct(applied)),
        FunnelStageNew(stage="screening", count=screening, percentage_of_top=_pct(screening)),
        FunnelStageNew(stage="interview", count=interview, percentage_of_top=_pct(interview)),
        FunnelStageNew(stage="offer", count=offer, percentage_of_top=_pct(offer)),
    ]


# ---------------------------------------------------------------------------
# 2.6 Funnel insight (Russian copy, SPEC §4.5)
# ---------------------------------------------------------------------------


def _generate_funnel_insight(
    funnel: list[FunnelStageNew],
    current_streak_days: int,
) -> str | None:
    """Return the auto-generated funnel insight callout (SPEC §4.5).

    Rules are evaluated in priority order; the first match wins. Returns
    ``None`` if ``applied == 0`` so the callout can be hidden by the
    frontend (no signal to comment on yet).
    """
    by_stage = {s.stage: s.count for s in funnel}
    saved = by_stage.get("saved", 0)
    applied = by_stage.get("applied", 0)
    screening = by_stage.get("screening", 0)
    interview = by_stage.get("interview", 0)
    offer = by_stage.get("offer", 0)

    if applied == 0:
        return None

    if offer > 0 and (offer / applied) >= 0.10:
        return "Конверсия в оффер выше среднего — отличная работа"
    if (interview / applied) >= 0.20:
        return "Конверсия в интервью выше среднего — продолжай в том же духе"
    if (screening / applied) >= 0.30:
        return "Высокий процент откликов попадает в скрининг — резюме работает"
    if saved > 0 and (applied / saved) >= 0.60:
        return "Ты не складываешь вакансии в долгий ящик — это правильная привычка"
    if current_streak_days >= 7:
        return "Неделя ежедневной активности — самое сложное позади"
    return "Продолжай — каждая поданная заявка приближает к офферу"


# ---------------------------------------------------------------------------
# 2.7 Generations timeline
# ---------------------------------------------------------------------------


def _compute_generations_timeline(
    user_id: uuid.UUID,
    period: Period,
    db: Session,
) -> tuple[list[GenerationBucket], int, int]:
    """Return ``(buckets, total_resumes, total_cover_letters)`` per SPEC §4.7.

    Source: ``usage_log`` filtered to the two generation operation types.
    Granularity matches the applications timeline (SPEC §4.1) so the
    frontend can stack the two charts visually.
    """
    end_now = _utc_now()
    start, end = _period_window(period, end_now)
    granularity = _granularity(period)

    earliest_for_all: date | None = None
    if period == "all":
        earliest_for_all = (
            db.query(func.min(func.date(UsageLog.created_at)))
            .filter(
                UsageLog.user_id == user_id,
                UsageLog.operation_type.in_(_GENERATION_OPS),
                UsageLog.success.is_(True),
            )
            .scalar()
        )
        if earliest_for_all is None:
            earliest_for_all = end.date().replace(day=1)
        start = datetime.combine(earliest_for_all.replace(day=1), datetime.min.time())

    expected = _expected_buckets(period, start, end, earliest=earliest_for_all)

    rows = (
        db.query(
            func.date(UsageLog.created_at).label("d"),
            UsageLog.operation_type.label("op"),
            func.count(UsageLog.id).label("c"),
        )
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.operation_type.in_(_GENERATION_OPS),
            UsageLog.success.is_(True),
            UsageLog.created_at >= start,
            UsageLog.created_at < end,
        )
        .group_by(text("1"), text("2"))
        .all()
    )

    resume_counts: dict[date, int] = defaultdict(int)
    cl_counts: dict[date, int] = defaultdict(int)
    for row in rows:
        bucket = _bucket_key_for(row.d, granularity)
        if row.op == _OP_TAILOR_RESUME:
            resume_counts[bucket] += row.c
        elif row.op == _OP_GENERATE_CL:
            cl_counts[bucket] += row.c

    buckets = [
        GenerationBucket(
            date=b,
            resumes=resume_counts.get(b, 0),
            cover_letters=cl_counts.get(b, 0),
        )
        for b in expected
    ]
    total_resumes = sum(b.resumes for b in buckets)
    total_cover_letters = sum(b.cover_letters for b in buckets)
    return buckets, total_resumes, total_cover_letters


# ---------------------------------------------------------------------------
# 2.8 Recent activity feed
# ---------------------------------------------------------------------------


def _format_app_tail(company: str | None, role: str | None) -> str:
    """Format the trailing ``<strong>{company}</strong> — {role}`` segment."""
    parts = []
    if company:
        parts.append(f"<strong>{company}</strong>")
    if role:
        parts.append(role)
    return " — ".join(parts)


def _compute_recent_activity(
    user_id: uuid.UUID,
    db: Session,
    limit: int = 10,
) -> list[ActivityEvent]:
    """Merge the three event streams per SPEC §4.8.

    Streams (each fetched at ``limit * 2`` so the merge step has enough
    headroom to fill the final window after sorting):

      1. Status transitions from ``application_status_history``
      2. Generations from ``usage_log`` (tailor / cover letter)
      3. Synthetic ``job_saved`` events from ``Application.created_at``

    Result is sorted by ``occurred_at`` desc and trimmed to ``limit``.
    """
    fetch = max(limit * 2, 20)
    events: list[ActivityEvent] = []

    # ---- 1. Status transition events ---------------------------------------
    status_rows = (
        db.query(
            ApplicationStatusHistory.id.label("hid"),
            ApplicationStatusHistory.application_id.label("application_id"),
            ApplicationStatusHistory.to_status.label("to_status"),
            ApplicationStatusHistory.created_at.label("occurred_at"),
            Job.company.label("company"),
            Job.title.label("role"),
        )
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .join(Job, Job.id == Application.job_id)
        .filter(
            ApplicationStatusHistory.user_id == user_id,
            ApplicationStatusHistory.from_status.isnot(None),
            ApplicationStatusHistory.to_status.in_(list(_FEED_STATUS_TRANSITIONS.keys())),
        )
        .order_by(ApplicationStatusHistory.created_at.desc())
        .limit(fetch)
        .all()
    )
    for row in status_rows:
        event_type: ActivityEventType = _FEED_STATUS_TRANSITIONS[row.to_status]  # type: ignore[assignment]
        verb = _STATUS_TITLE_VERB[row.to_status]
        tail = _format_app_tail(row.company, row.role)
        title = f"{verb} · {tail}" if tail else verb
        events.append(
            ActivityEvent(
                id=f"status_{row.hid}",
                type=event_type,
                occurred_at=row.occurred_at,
                title=title,
                meta=(
                    f"новый статус: {_STATUS_RU[row.to_status]}"
                    if row.to_status in _STATUS_RU
                    else None
                ),
                application_id=str(row.application_id),
                company=row.company,
                role=row.role,
                to_status=row.to_status.value,
            )
        )

    # ---- 2. Generation events ---------------------------------------------
    gen_rows = (
        db.query(
            UsageLog.id.label("uid"),
            UsageLog.operation_type.label("op"),
            UsageLog.entity_id.label("entity_id"),
            UsageLog.created_at.label("occurred_at"),
        )
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.operation_type.in_(_GENERATION_OPS),
            UsageLog.success.is_(True),
        )
        .order_by(UsageLog.created_at.desc())
        .limit(fetch)
        .all()
    )

    # Pre-fetch related job/application data in one shot to avoid N+1 on
    # the per-entity title lookup.
    tailored_ids = [r.entity_id for r in gen_rows if r.op == _OP_TAILOR_RESUME and r.entity_id]
    cl_ids = [r.entity_id for r in gen_rows if r.op == _OP_GENERATE_CL and r.entity_id]

    tailored_meta: dict[uuid.UUID, tuple[str | None, str | None, int | None, uuid.UUID | None]] = {}
    if tailored_ids:
        for tr in (
            db.query(
                TailoredResume.id,
                Job.company,
                Job.title,
                TailoredResume.match_score,
                Application.id.label("application_id"),
            )
            .join(Job, Job.id == TailoredResume.job_id)
            .outerjoin(Application, Application.job_id == Job.id)
            .filter(TailoredResume.id.in_(tailored_ids))
            .all()
        ):
            tailored_meta[tr.id] = (tr.company, tr.title, tr.match_score, tr.application_id)

    cl_meta: dict[uuid.UUID, tuple[str | None, str | None, str | None, uuid.UUID | None]] = {}
    if cl_ids:
        for cl in (
            db.query(
                CoverLetter.id,
                Job.company,
                Job.title,
                CoverLetter.tone,
                Application.id.label("application_id"),
            )
            .outerjoin(Job, Job.id == CoverLetter.job_id)
            .outerjoin(Application, Application.job_id == Job.id)
            .filter(CoverLetter.id.in_(cl_ids))
            .all()
        ):
            cl_meta[cl.id] = (
                cl.company,
                cl.title,
                cl.tone.value if cl.tone is not None else None,
                cl.application_id,
            )

    for row in gen_rows:
        if row.op == _OP_TAILOR_RESUME:
            event_type = "resume_tailored"
            company = role = None
            app_id: uuid.UUID | None = None
            if row.entity_id and row.entity_id in tailored_meta:
                company, role, _score, app_id = tailored_meta[row.entity_id]
            tail = _format_app_tail(company, role)
            title = (
                f"Адаптировал резюме · {tail}"
                if tail
                else "Адаптировал резюме"
            )
            # SPEC §3.2 — match score not yet wired (no tailored_resume->score
            # surfacing on this event); leave meta empty until Phase 4.
            meta: str | None = None
            event_id = f"resume_{row.uid}"
        else:  # generate_cover_letter
            event_type = "cover_letter_generated"
            company = role = tone = None
            app_id = None
            if row.entity_id and row.entity_id in cl_meta:
                company, role, tone, app_id = cl_meta[row.entity_id]
            tail = _format_app_tail(company, role)
            title = (
                f"Сгенерировал cover letter · {tail}"
                if tail
                else "Сгенерировал cover letter"
            )
            meta = f"тон: {tone}" if tone else None
            event_id = f"cl_{row.uid}"

        events.append(
            ActivityEvent(
                id=event_id,
                type=event_type,  # type: ignore[arg-type]
                occurred_at=row.occurred_at,
                title=title,
                meta=meta,
                application_id=str(app_id) if app_id else None,
                company=company,
                role=role,
                to_status=None,
            )
        )

    # ---- 3. Synthetic job_saved events ------------------------------------
    # Per SPEC §4.8 / task 2.8: only emit a job_saved event for applications
    # that have NO non-initial status history — i.e. the user saved the
    # job but has not yet transitioned its status away from the initial
    # state. Applications that have moved on are already represented in
    # the status_change_* stream above; double-counting them would clutter
    # the feed.
    has_transitions_subq = (
        db.query(ApplicationStatusHistory.application_id)
        .filter(
            ApplicationStatusHistory.user_id == user_id,
            ApplicationStatusHistory.from_status.isnot(None),
        )
        .subquery()
    )
    saved_rows = (
        db.query(
            Application.id.label("application_id"),
            Application.created_at.label("occurred_at"),
            Job.company.label("company"),
            Job.title.label("role"),
        )
        .join(Job, Job.id == Application.job_id)
        .filter(
            Job.user_id == user_id,
            ~Application.id.in_(db.query(has_transitions_subq.c.application_id)),
        )
        .order_by(Application.created_at.desc())
        .limit(fetch)
        .all()
    )
    for row in saved_rows:
        tail = _format_app_tail(row.company, row.role)
        title = f"Сохранил вакансию · {tail}" if tail else "Сохранил вакансию"
        events.append(
            ActivityEvent(
                id=f"saved_{row.application_id}",
                type="job_saved",
                occurred_at=row.occurred_at,
                title=title,
                meta=None,
                application_id=str(row.application_id),
                company=row.company,
                role=row.role,
                to_status=None,
            )
        )

    # ---- Merge + trim ------------------------------------------------------
    events.sort(key=lambda e: e.occurred_at, reverse=True)
    return events[:limit]


# ---------------------------------------------------------------------------
# Status breakdown (active pipeline donut, SPEC §5.4)
# ---------------------------------------------------------------------------


def _compute_status_breakdown(
    user_id: uuid.UUID,
    db: Session,
) -> list[StatusCount]:
    """Return current-status counts for the active pipeline donut.

    Same shape as the legacy ``get_status_breakdown`` but typed against
    the new ``StatusCount`` model (which uses the ``ApplicationStatus``
    enum directly rather than the string value)."""
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
    return [StatusCount(status=row[0], count=row[1]) for row in rows]


# ---------------------------------------------------------------------------
# Orchestrator (SPEC §8.1)
# ---------------------------------------------------------------------------


def get_full_analytics(
    user_id: uuid.UUID,
    period: Period,
    db: Session,
) -> AnalyticsResponse:
    """Assemble the full ``AnalyticsResponse`` payload (SPEC §3.1).

    Single entry point used by the new ``GET /api/analytics`` endpoint
    (Phase 3). All ``_compute_*`` helpers are called here so the wire
    format and orchestration are co-located.
    """
    end_now = _utc_now()
    start, end = _period_window(period, end_now)

    # Hero block ------------------------------------------------------------
    timeline_curr, timeline_prev = _compute_applications_timeline(user_id, period, db)
    applications_current = sum(b.count for b in timeline_curr)
    applications_previous = sum(b.count for b in timeline_prev)

    # Streak panel ----------------------------------------------------------
    daily_activity = _compute_daily_activity(user_id, db, days=91)
    all_time_history = _query_all_time_daily_activity(user_id, db)
    current_streak_days, longest_streak_days = _compute_streak(daily_activity, all_time_history)
    personal_best = _compute_personal_best(user_id, db, history=all_time_history)

    # KPI strip -------------------------------------------------------------
    kpis = _compute_kpi_metrics(user_id, period, db)

    # Funnel + insight ------------------------------------------------------
    funnel = _compute_funnel(user_id, period, db)
    funnel_insight = _generate_funnel_insight(funnel, current_streak_days)

    # Status donut ----------------------------------------------------------
    status_breakdown = _compute_status_breakdown(user_id, db)

    # Generations area chart ------------------------------------------------
    gen_buckets, total_resumes, total_cover_letters = _compute_generations_timeline(
        user_id, period, db
    )

    # Activity feed ---------------------------------------------------------
    recent_activity = _compute_recent_activity(user_id, db, limit=10)

    # Period bounds reported back to the client. For ``all`` we report the
    # actual data span used (or today if there's no data) so the frontend
    # can render a meaningful X-axis label.
    if period == "all" and timeline_curr:
        period_start_d: date = timeline_curr[0].date
    else:
        period_start_d = start.date()

    return AnalyticsResponse(
        period=period,
        period_start=period_start_d,
        period_end=end.date(),
        applications_current=applications_current,
        applications_previous=applications_previous,
        applications_delta=applications_current - applications_previous,
        applications_timeline=timeline_curr,
        applications_timeline_previous=timeline_prev,
        current_streak_days=current_streak_days,
        longest_streak_days=longest_streak_days,
        daily_activity=daily_activity,
        personal_best=personal_best,
        jobs_saved=kpis["jobs_saved"],
        applied=kpis["applied"],
        interviews=kpis["interviews"],
        offers=kpis["offers"],
        funnel=funnel,
        funnel_insight=funnel_insight,
        status_breakdown=status_breakdown,
        generations_total_resumes=total_resumes,
        generations_total_cover_letters=total_cover_letters,
        generations_timeline=gen_buckets,
        recent_activity=recent_activity,
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
