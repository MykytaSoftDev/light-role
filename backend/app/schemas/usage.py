from datetime import datetime

from pydantic import BaseModel


class EffectiveLimits(BaseModel):
    ai_operations: int
    active_jobs: int | None  # None = unlimited
    # DASHBOARD-1: per-credit-type limits surfaced for the dashboard's split
    # progress bars. -1 = unlimited (consistent with `ai_operations`).
    resume_credits: int = -1
    cl_credits: int = -1


class UsageResponse(BaseModel):
    ai_operations_used: int
    ai_operations_limit: int
    effective_plan: str  # plan slug, e.g. "free" or "pro"
    effective_limits: EffectiveLimits
    reset_date: datetime
    active_jobs_count: int
    applications_this_month: int
    # DASHBOARD-1: split AI usage by credit type. -1 limit = unlimited.
    resume_credits_used: int = 0
    resume_credits_limit: int = -1
    cl_credits_used: int = 0
    cl_credits_limit: int = -1
    # MONETIZE-7: anniversary-cycle metadata for the dashboard. Defaults
    # keep older clients (and any test fixtures that built UsageResponse
    # directly) working unchanged.
    days_until_reset: int = 0
    plan_name: str | None = None
