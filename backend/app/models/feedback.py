from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import FeedbackStatus, FeedbackType

if TYPE_CHECKING:
    from app.models.user import User


class Feedback(TimestampMixin, Base):
    __tablename__ = "feedbacks"

    __table_args__ = (
        Index("ix_feedback_user_id", "user_id"),
        Index("ix_feedback_status", "status"),
        Index("ix_feedback_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[FeedbackType] = mapped_column(
        SAEnum(FeedbackType, name="feedbacktype", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    page_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    status: Mapped[FeedbackStatus] = mapped_column(
        SAEnum(FeedbackStatus, name="feedbackstatus", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=FeedbackStatus.NEW,
        server_default=FeedbackStatus.NEW.value,
    )
    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="feedbacks",
    )
