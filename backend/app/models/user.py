from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AuthProvider

if TYPE_CHECKING:
    from app.models.admin_audit_log import AdminAuditLog
    from app.models.ai_quality_rating import AIQualityRating
    from app.models.cover_letter import CoverLetter
    from app.models.feedback import Feedback
    from app.models.job import Job
    from app.models.notification import Notification
    from app.models.profile import UserProfile
    from app.models.subscription import Subscription
    from app.models.tailored_resume import TailoredResume
    from app.models.usage_log import UsageLog

_NOTIFICATION_PREFS_DEFAULT = (
    '\'{"all_enabled": true, "follow_up_reminders": true, '
    '"inactivity_nudges": true, "limit_warnings": true, '
    '"limit_reset": true}\'::jsonb'
)

# PRD 6.3 — default resume_preferences for new users. Mirrors the
# server_default written in migration 013.
_RESUME_PREFERENCES_DEFAULT_JSON = (
    '\'{"sections_order": ["summary", "employment", "education", '
    '"projects", "skills", "certificates", "languages", "achievements", '
    '"volunteer"], "font": "Inter", "template": "classic"}\'::jsonb'
)


def _resume_preferences_default() -> dict:
    """Python-side default for `resume_preferences` (PRD 6.3)."""
    return {
        "sections_order": [
            "summary",
            "employment",
            "education",
            "projects",
            "skills",
            "certificates",
            "languages",
            "achievements",
            "volunteer",
        ],
        "font": "Inter",
        "template": "classic",
    }


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    first_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        SAEnum(AuthProvider, name="authprovider", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=AuthProvider.EMAIL,
        server_default=AuthProvider.EMAIL.value,
    )
    google_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="FALSE",
    )
    notification_preferences: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text(_NOTIFICATION_PREFS_DEFAULT),
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="FALSE",
    )
    resume_preferences: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=_resume_preferences_default,
        server_default=text(_RESUME_PREFERENCES_DEFAULT_JSON),
    )
    complete_steps_dismissed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )
    is_admin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    # Relationships
    jobs: Mapped[List[Job]] = relationship(
        "Job",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    cover_letters: Mapped[List[CoverLetter]] = relationship(
        "CoverLetter",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    subscription: Mapped[Subscription | None] = relationship(
        "Subscription",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    usage_logs: Mapped[List[UsageLog]] = relationship(
        "UsageLog",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UsageLog.user_id",
    )
    notifications: Mapped[List[Notification]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    feedbacks: Mapped[List[Feedback]] = relationship(
        "Feedback",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    profile: Mapped[UserProfile | None] = relationship(
        "UserProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    tailored_resumes: Mapped[List[TailoredResume]] = relationship(
        "TailoredResume",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    ai_quality_ratings: Mapped[List[AIQualityRating]] = relationship(
        "AIQualityRating",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    # Audit log relationships — two FKs from admin_audit_logs land on
    # users.id (admin_id and target_user_id), so each side must declare
    # ``foreign_keys=...`` explicitly. We deliberately do NOT cascade
    # deletes: audit rows must persist after the acting admin is
    # deleted. The DB-level ``ON DELETE SET NULL`` on admin_id (migration
    # 021) plus the denormalized ``admin_email_snapshot`` column preserve
    # attribution forever. ``passive_deletes=True`` is essential — without
    # it SQLAlchemy would auto-emit an UPDATE setting admin_id = NULL
    # before the parent DELETE, racing the DB-level SET NULL and (when
    # admin_id was still NOT NULL pre-021) triggering an IntegrityError.
    admin_audit_logs_authored: Mapped[List[AdminAuditLog]] = relationship(
        "AdminAuditLog",
        back_populates="admin",
        foreign_keys="AdminAuditLog.admin_id",
        cascade="save-update, merge",
        passive_deletes=True,
    )
    admin_audit_logs_received: Mapped[List[AdminAuditLog]] = relationship(
        "AdminAuditLog",
        back_populates="target_user",
        foreign_keys="AdminAuditLog.target_user_id",
        passive_deletes=True,
    )
