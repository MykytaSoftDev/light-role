from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UsageLog(Base):
    """Business audit log for credit-consuming AI operations (PRD 6.12).

    Replaces the legacy `usage_logs` AI-telemetry table dropped in
    migration 015. `operation_type`, `cost_type`, and `entity_type` are
    plain VARCHAR (NOT PG enums) so new operation/cost types can be
    introduced without an ALTER TYPE migration. Pydantic Literal validation
    in ARCH-11 covers the application-level whitelist.

    Allowed values:
      - operation_type: tailor_resume | generate_cover_letter | parse_job
                       | parse_profile
      - cost_type:     resume_credit | cl_credit | free
    """

    __tablename__ = "usage_log"

    __table_args__ = (
        Index(
            "ix_usage_log_user_id_created_at",
            "user_id",
            "created_at",
        ),
        Index("ix_usage_log_operation_type", "operation_type"),
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
    operation_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    cost_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    success: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
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
