from __future__ import annotations

from pydantic import BaseModel


class FunnelStage(BaseModel):
    stage: str
    count: int
    pct_of_saved: float
    drop_off_pct: float | None  # vs previous stage


class FunnelData(BaseModel):
    stages: list[FunnelStage]
    insight: str | None  # filled by insight generator


class TimelineMonth(BaseModel):
    month: str  # "2025-10"
    count: int


class StatusCount(BaseModel):
    status: str
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


class AnalyticsResponse(BaseModel):
    funnel: FunnelData
    timeline: list[TimelineMonth]  # 6 months
    status_breakdown: list[StatusCount]
    resume_performance: ResumePerformanceData
    ai_operations: list[AIOperationCount]
    response_time: ResponseTimeData
    hero_counters: HeroCounters
    data_sufficiency: DataSufficiency
