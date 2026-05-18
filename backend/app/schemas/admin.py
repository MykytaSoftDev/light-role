"""Admin schemas (SPEC §4.6).

Adjustments vs the SPEC:

- ``AdminUserListItem`` gains ``plan_name`` (humanized) so the admin UI
  doesn't have to map slug → label client-side.
- ``AdminUserCounts`` replaces ``counts: dict[str, int]`` so the frontend
  has a typed shape (and ``applications`` is surfaced alongside ``jobs``,
  which are not the same thing in this codebase: ``jobs`` are the
  job-description records, ``applications`` are the per-job tracker rows).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import AuthProvider, FeedbackStatus, FeedbackType, SubscriptionStatus
from app.schemas.subscription import SubscriptionResponse
from app.schemas.usage import UsageResponse


class AdminUserListItem(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    auth_provider: AuthProvider
    plan_slug: Optional[str]
    plan_name: Optional[str]
    subscription_status: Optional[SubscriptionStatus]
    is_verified: bool
    is_admin: bool
    ai_operations_used_current_cycle: int
    active_jobs_count: int
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int


class AdminUserCounts(BaseModel):
    jobs: int
    applications: int
    resumes: int  # tailored_resumes
    cover_letters: int
    feedbacks: int


class AdminLifetimeUsage(BaseModel):
    """All-time successful credit-consuming operations (impersonator excluded).

    Counted from ``usage_log`` with no cycle window — every successful
    ``resume_credit`` / ``cl_credit`` operation the user has ever paid for.
    Useful for Unlimited-plan customers (who have no cycle quota) and for
    admin context regardless of plan.
    """

    resume_generations: int
    cl_generations: int


class AdminUserDetail(BaseModel):
    user: AdminUserListItem
    subscription: Optional[SubscriptionResponse]
    usage: UsageResponse
    counts: AdminUserCounts
    lifetime_usage: AdminLifetimeUsage


class GrantProRequest(BaseModel):
    days: int = Field(gt=0, le=365)


class AdminAuditLogItem(BaseModel):
    id: uuid.UUID
    # ``admin_id`` is nullable after migration 021: when an admin
    # deletes their account the FK becomes NULL, but the row survives.
    # The service still always supplies a non-empty ``admin_email``
    # (falling back to ``admin_email_snapshot`` or "(deleted admin)").
    admin_id: Optional[uuid.UUID]
    admin_email: str
    target_user_id: Optional[uuid.UUID]
    target_user_email: Optional[str]
    action: str
    payload: dict
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminAuditLogListResponse(BaseModel):
    items: list[AdminAuditLogItem]
    total: int
    page: int
    page_size: int


class AdminFeedbackItem(BaseModel):
    """Single feedback row in the admin feedback viewer (SPEC §5.6).

    Joined with the submitting user's email/name so the table can display
    "User" column entries without a second per-row lookup on the FE.
    """

    id: uuid.UUID
    user_id: uuid.UUID
    user_email: EmailStr
    user_first_name: Optional[str]
    user_last_name: Optional[str]
    type: FeedbackType
    status: FeedbackStatus
    message: str
    page_url: Optional[str]
    user_agent: Optional[str]
    created_at: datetime
    admin_notes: Optional[str]

    model_config = {"from_attributes": True}


class AdminFeedbackListResponse(BaseModel):
    items: list[AdminFeedbackItem]
    total: int
    page: int
    page_size: int
