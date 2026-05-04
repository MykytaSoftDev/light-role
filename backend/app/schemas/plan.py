import uuid
from datetime import datetime

from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None
    paddle_price_id_monthly: str | None
    paddle_price_id_annual: str | None
    price_monthly_cents: int
    price_annual_cents: int
    max_active_jobs: int | None
    resume_credits_per_cycle: int | None
    cl_credits_per_cycle: int | None
    analytics_enabled: bool
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanListResponse(BaseModel):
    data: list[PlanResponse]
