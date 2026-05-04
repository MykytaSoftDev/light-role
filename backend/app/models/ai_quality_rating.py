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
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.tailored_resume import TailoredResume
    from app.models.user import User


class AIQualityRating(Base):
    """User star-rating (1-5) of an AI-tailored resume (PRD 6.10).

    Write-once per resume — there is no `updated_at`. The UNIQUE on
    `tailored_resume_id` enforces "exactly one rating per tailored resume"
    and doubles as the lookup index for that column.
    """

    __tablename__ = "ai_quality_ratings"

    __table_args__ = (
        UniqueConstraint(
            "tailored_resume_id",
            name="uq_ai_quality_ratings_tailored_resume_id",
        ),
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_ai_quality_ratings_rating",
        ),
        Index("ix_ai_quality_ratings_user_id", "user_id"),
        Index("ix_ai_quality_ratings_rating", "rating"),
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
    tailored_resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tailored_resumes.id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )
    comment: Mapped[str | None] = mapped_column(
        Text,
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
        back_populates="ai_quality_ratings",
    )
    tailored_resume: Mapped[TailoredResume] = relationship(
        "TailoredResume",
        back_populates="rating",
    )
