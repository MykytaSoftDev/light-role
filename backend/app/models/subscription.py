from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import SubscriptionStatus

if TYPE_CHECKING:
    from app.models.plan import Plan
    from app.models.user import User


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    __table_args__ = (
        Index("ix_subscription_user_id", "user_id", unique=True),
        Index("ix_subscription_paddle_customer", "paddle_customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plans.id"),
        nullable=False,
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        SAEnum(SubscriptionStatus, name="subscriptionstatus", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=SubscriptionStatus.ACTIVE,
        server_default=SubscriptionStatus.ACTIVE.value,
    )
    current_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default="now()",
    )
    current_period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
    )
    paddle_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    paddle_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="subscription",
    )
    plan: Mapped[Plan] = relationship(
        "Plan",
        lazy="joined",
    )
