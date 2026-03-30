import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SubscriptionStatus


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: str  # plan slug, e.g. "free" or "pro"
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime

    model_config = {"from_attributes": True}


class PlanLimits(BaseModel):
    ai_operations: int
    active_jobs: int | None  # None means unlimited


class SubscriptionDetailResponse(BaseModel):
    id: uuid.UUID
    plan: str  # plan slug
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    paddle_subscription_id: str | None
    limits: PlanLimits
    current_usage: int
    reset_date: datetime

    model_config = {"from_attributes": True}


class SaveCustomerIdRequest(BaseModel):
    paddle_customer_id: str
