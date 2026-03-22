from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SubscriptionPlan


class EffectiveLimits(BaseModel):
    ai_operations: int
    active_jobs: int | None  # None = unlimited


class UsageResponse(BaseModel):
    ai_operations_used: int
    ai_operations_limit: int
    effective_plan: SubscriptionPlan
    effective_limits: EffectiveLimits
    reset_date: datetime
    active_jobs_count: int
    applications_this_month: int
