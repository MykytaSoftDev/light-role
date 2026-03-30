import uuid
from datetime import datetime

from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    paddle_price_id_monthly: str | None
    paddle_price_id_annual: str | None
    price_monthly_cents: int
    price_annual_cents: int
    currency: str
    max_active_jobs: int
    max_ai_ops_monthly: int
    max_resume_templates: int
    has_analytics: bool
    has_priority_ai: bool
    features_json: list
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanListResponse(BaseModel):
    data: list[PlanResponse]
