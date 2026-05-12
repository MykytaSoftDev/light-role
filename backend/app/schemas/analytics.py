from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.models.enums import ApplicationStatus

# ---------------------------------------------------------------------------
# Analytics redesign — new shape (SPEC-analytics-redesign.md §3.1, §3.2)
#
# These models replace the legacy AnalyticsResponse / FunnelData /
# ResumePerformanceData / HeroCounters / etc. shape. The legacy classes
# below this section are intentionally retained until Phase 10.5 cleanup
# so that any in-flight imports keep working while Phases 2–3 land.
# ---------------------------------------------------------------------------


Period = Literal["7d", "30d", "90d", "all"]


class TimelineBucket(BaseModel):
    """One bucket of the applications timeline.

    Granularity (day / week / month) is determined by the requesting
    period — the bucket date is the start of the bucket regardless.
    """

    date: date
    count: int


class DailyActivity(BaseModel):
    """One day in the activity heatmap (always daily granularity).

    Period-independent: the heatmap always covers the last ~91 days so
    the streak and personal-best computations stay stable when the user
    switches the page period selector.
    """

    date: date
    count: int


class PersonalBest(BaseModel):
    """Best 7-day window of applications, all-time."""

    start_date: date
    end_date: date
    count: int
    metric: Literal["applications"]


class KpiMetric(BaseModel):
    """One headline KPI on the strip (saved / applied / interview / offer)."""

    current: int
    delta: int
    sparkline: list[int]


class FunnelStage(BaseModel):
    """One stage row of the cumulative funnel.

    Cumulative semantics: e.g. ``interview.count`` includes every
    application that ever reached interview, even if it has since
    moved to offer or rejected. ``percentage_of_top`` is the count
    divided by the ``saved`` stage count (or 0 if saved == 0).
    """

    stage: Literal["saved", "applied", "screening", "interview", "offer"]
    count: int
    percentage_of_top: float


class StatusCount(BaseModel):
    """One slice of the active-pipeline donut."""

    status: ApplicationStatus
    count: int


class GenerationBucket(BaseModel):
    """One bucket of the document-generation timeline.

    Granularity matches the applications timeline for visual alignment.
    Counts are split by operation type so the chart can stack them.
    """

    date: date
    resumes: int
    cover_letters: int


ActivityEventType = Literal[
    "status_change_offer",
    "status_change_interview",
    "status_change_screening",
    "status_change_applied",
    "status_change_rejected",
    "resume_tailored",
    "cover_letter_generated",
    "job_saved",
]


class ActivityEvent(BaseModel):
    """One row in the recent-activity feed.

    ``id`` is composite (``f"{source}_{source_id}"``) so the frontend
    can key a list without colliding rows from the three event sources.
    ``application_id`` is set whenever the event has a parent
    application (i.e. always except for purely synthetic future events).

    Localization note: ``title`` and ``meta`` are DEPRECATED — the
    backend used to do string formatting + localization (Russian), which
    is the wrong layer. They are still populated for backward compat
    during the frontend migration; once the frontend renders from the
    structured fields below, the legacy fields can be dropped.

    The structured fields (``company``, ``role``, ``to_status``) let the
    frontend build localized labels from translation strings. They are
    populated for every event type where a parent application can be
    resolved.
    """

    id: str
    type: ActivityEventType
    occurred_at: datetime
    title: str  # DEPRECATED — populated for transition; frontend builds from structured fields below
    meta: str | None = None  # DEPRECATED for status changes; kept for future use (match score, tone, etc.)
    application_id: str | None = None

    # New structured fields — populate for relevant event types.
    company: str | None = None   # populated when application_id is known
    role: str | None = None      # populated when application_id is known
    to_status: str | None = None # populated for status_change_* events (value like "applied", "interview", "offer")


class AnalyticsResponse(BaseModel):
    """Full payload for ``GET /api/analytics?period={...}``.

    Single round-trip: every block on /dashboard/analytics is fed from
    one of the fields below. Computation is orchestrated by
    AnalyticsService.get_full_analytics in Phase 2; caching is handled
    in Phase 3.
    """

    period: Period
    period_start: date
    period_end: date

    # Hero block — big number + dual-line chart.
    applications_current: int
    applications_previous: int
    applications_delta: int
    applications_timeline: list[TimelineBucket]
    applications_timeline_previous: list[TimelineBucket]

    # Streak panel — heatmap is period-independent (always last 91 days).
    current_streak_days: int
    longest_streak_days: int
    daily_activity: list[DailyActivity]
    personal_best: PersonalBest | None = None

    # KPI strip — 4 cards with sparklines.
    jobs_saved: KpiMetric
    applied: KpiMetric
    interviews: KpiMetric
    offers: KpiMetric

    # Funnel + insight callout.
    funnel: list[FunnelStage]
    funnel_insight: str | None = None

    # Active-pipeline donut.
    status_breakdown: list[StatusCount]

    # Generations area chart.
    generations_total_resumes: int
    generations_total_cover_letters: int
    generations_timeline: list[GenerationBucket]

    # Recent-activity feed.
    recent_activity: list[ActivityEvent]


# ---------------------------------------------------------------------------
# LEGACY shape — kept until Phase 10.5 cleanup so any callers still
# importing these names don't break mid-migration. Do not add new
# usages; do not extend these models. New analytics features go on
# AnalyticsResponse above.
# ---------------------------------------------------------------------------


class FunnelStageLegacy(BaseModel):
    """LEGACY funnel stage shape (drop_off_pct semantics).

    Used only by analytics_service.compute_funnel and
    analytics_insights.get_funnel_insight pending Phase 2 rewrite.
    Do not use in new code — see ``FunnelStage`` above for the
    cumulative-counts shape that lands with the redesign.
    """

    stage: str
    count: int
    pct_of_saved: float
    drop_off_pct: float | None  # vs previous stage


class FunnelData(BaseModel):
    stages: list[FunnelStageLegacy]
    insight: str | None  # filled by insight generator


class TimelineMonth(BaseModel):
    month: str  # "2025-10"
    count: int


class ResumeSparklinePoint(BaseModel):
    score: int
    resume_id: str
    resume_name: str


class ResumePerformanceData(BaseModel):
    avg_score: float | None
    sparkline: list[ResumeSparklinePoint]  # last 10 tailored resumes
    best_resume_id: str | None
    best_resume_name: str | None
    best_score: int | None
    worst_resume_id: str | None
    worst_resume_name: str | None
    worst_score: int | None
    trend: str | None  # "improving" | "declining" | "stable" — filled by insight gen


class AIOperationCount(BaseModel):
    operation_type: str
    count: int


class HeroCounters(BaseModel):
    jobs_saved: int
    applied: int
    interviews: int
    offers: int
    jobs_saved_delta: int
    applied_delta: int
    interviews_delta: int
    offers_delta: int


class ResponseTimeData(BaseModel):
    avg_days: float | None


class DataSufficiency(BaseModel):
    total_jobs: int
    total_applications: int
    total_scored_resumes: int
    threshold_jobs: int       # 5
    threshold_applications: int  # 5
    threshold_scored_resumes: int  # 3
    has_sufficient_data: bool  # true when total_applications >= 5


class AnalyticsResponseLegacy(BaseModel):
    """LEGACY full analytics payload.

    Still served by the existing /api/v1/analytics endpoint until
    Phase 3 of the redesign rewires the router to assemble the new
    ``AnalyticsResponse`` shape. Kept under a distinct name so the new
    response model can claim the canonical ``AnalyticsResponse`` symbol
    while the legacy code path keeps compiling.
    """

    funnel: FunnelData
    timeline: list[TimelineMonth]  # 6 months
    status_breakdown: list[StatusCount]
    resume_performance: ResumePerformanceData
    ai_operations: list[AIOperationCount]
    response_time: ResponseTimeData
    hero_counters: HeroCounters
    data_sufficiency: DataSufficiency
