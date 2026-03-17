from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Enum as SAEnum, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AuthProvider

if TYPE_CHECKING:
    from app.models.cover_letter import CoverLetter
    from app.models.job import Job
    from app.models.notification import Notification
    from app.models.resume import Resume
    from app.models.subscription import Subscription
    from app.models.usage_log import UsageLog

_NOTIFICATION_PREFS_DEFAULT = (
    '\'{"all_enabled": true, "follow_up_reminders": true, '
    '"inactivity_nudges": true, "limit_warnings": true, '
    '"limit_reset": true}\'::jsonb'
)


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

    # Relationships
    jobs: Mapped[List[Job]] = relationship(
        "Job",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    resumes: Mapped[List[Resume]] = relationship(
        "Resume",
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
    )
    notifications: Mapped[List[Notification]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
