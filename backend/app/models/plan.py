from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class Plan(TimestampMixin, Base):
    """Three-tier monetization plan (PRD 6.8): Free / Pro / Unlimited.

    Per-cycle credit columns use NULL to indicate "unlimited" rather than
    a sentinel integer. `max_active_jobs` likewise uses NULL = unlimited.
    Defaults for `analytics_enabled` and `display_order` are set by the
    seed step (Phase 5.1), not by server_default.
    """

    __tablename__ = "plans"

    __table_args__ = (
        Index("ix_plan_code", "code", unique=True),
        Index(
            "ix_plan_price_id_monthly",
            "paddle_price_id_monthly",
            postgresql_where="paddle_price_id_monthly IS NOT NULL",
        ),
        Index(
            "ix_plan_price_id_annual",
            "paddle_price_id_annual",
            postgresql_where="paddle_price_id_annual IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    paddle_price_id_monthly: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    paddle_price_id_annual: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    price_monthly_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    price_annual_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # NULL = unlimited (PRD 6.8).
    max_active_jobs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # NULL = unlimited (PRD 6.8).
    resume_credits_per_cycle: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    # NULL = unlimited (PRD 6.8).
    cl_credits_per_cycle: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    analytics_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="TRUE"
    )
