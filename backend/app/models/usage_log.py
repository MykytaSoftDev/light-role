import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import OperationType

if TYPE_CHECKING:
    from app.models.user import User


class UsageLog(Base):
    __tablename__ = "usage_logs"

    __table_args__ = (
        Index("ix_usage_log_user_month", "user_id", "created_at"),
        Index("ix_usage_log_created_at", "created_at"),
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
    operation_type: Mapped[OperationType] = mapped_column(
        nullable=False,
    )
    ai_model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    tokens_input: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    tokens_output: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    response_time_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="usage_logs",
    )
