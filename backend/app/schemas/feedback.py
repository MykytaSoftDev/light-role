from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FeedbackStatus, FeedbackType


class FeedbackCreate(BaseModel):
    type: FeedbackType
    message: str = Field(min_length=10, max_length=5000)
    page_url: Optional[str] = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: FeedbackType
    message: str
    status: FeedbackStatus
    created_at: datetime
