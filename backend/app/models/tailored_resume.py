from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_quality_rating import AIQualityRating
    from app.models.job import Job
    from app.models.user import User


class TailoredResume(TimestampMixin, Base):
    """Snapshot-based per-job tailored resume (PRD 6.5).

    Each row stores a point-in-time snapshot of the user's profile,
    sections order, font, and template at the moment the resume was
    tailored — so subsequent profile edits do not retroactively change
    historical tailored resumes. The compound UNIQUE on (user_id, job_id)
    enforces "one tailored resume per (user, job)".
    """

    __tablename__ = "tailored_resumes"

    __table_args__ = (
        UniqueConstraint(
            "user_id", "job_id", name="uq_tailored_resumes_user_job"
        ),
        CheckConstraint(
            "match_score >= 0 AND match_score <= 100",
            name="ck_tailored_resumes_match_score",
        ),
        Index("ix_tailored_resumes_user_id", "user_id"),
        Index("ix_tailored_resumes_job_id", "job_id"),
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
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    profile_snapshot: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    tailored_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    matched_keywords: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
    )
    applied_changes: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
    )
    match_score: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )
    sections_order_snapshot: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
    )
    font_snapshot: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    template_snapshot: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    rating_modal_shown_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="tailored_resumes",
    )
    job: Mapped[Job] = relationship(
        "Job",
        back_populates="tailored_resume",
    )
    rating: Mapped[AIQualityRating | None] = relationship(
        "AIQualityRating",
        back_populates="tailored_resume",
        cascade="all, delete-orphan",
        uselist=False,
    )
