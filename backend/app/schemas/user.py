import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.enums import AuthProvider


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    auth_provider: AuthProvider
    is_verified: bool
    onboarding_completed: bool
    created_at: datetime
    # DASHBOARD-1: surfaced so the dashboard home knows whether to render
    # the "Complete steps" panel without a second round-trip.
    complete_steps_dismissed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DismissCompleteStepsResponse(BaseModel):
    """Returned by POST /api/v1/users/me/dismiss-complete-steps (DASHBOARD-1)."""

    complete_steps_dismissed_at: datetime


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

    @classmethod
    def normalize_email(cls, v: Optional[str]) -> Optional[str]:
        return v.lower().strip() if v else v
