from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class Plan(TimestampMixin, Base):
    __tablename__ = "plans"

    __table_args__ = (
        Index("ix_plan_slug", "slug", unique=True),
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
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    paddle_price_id_monthly: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    paddle_price_id_annual: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    price_monthly_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    price_annual_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    max_active_jobs: Mapped[int] = mapped_column(Integer, nullable=False)
    max_ai_ops_monthly: Mapped[int] = mapped_column(Integer, nullable=False)
    max_resume_templates: Mapped[int] = mapped_column(Integer, nullable=False)
    has_analytics: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="FALSE"
    )
    has_priority_ai: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="FALSE"
    )
    features_json: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="'[]'::jsonb"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="TRUE"
    )
