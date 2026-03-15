import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SubscriptionPlan, SubscriptionStatus


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: SubscriptionPlan
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime

    model_config = {"from_attributes": True}
