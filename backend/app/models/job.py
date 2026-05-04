from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.cover_letter import CoverLetter
    from app.models.tailored_resume import TailoredResume
    from app.models.user import User


class Job(TimestampMixin, Base):
    __tablename__ = "jobs"

    __table_args__ = (
        Index("ix_job_user_id", "user_id"),
        Index("ix_job_company", "company"),
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
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    company: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description_raw: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    requirements: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    salary: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    is_ai_parsed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="FALSE",
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="jobs",
    )
    application: Mapped[Application | None] = relationship(
        "Application",
        back_populates="job",
        cascade="all, delete-orphan",
        uselist=False,
    )
    cover_letters: Mapped[List[CoverLetter]] = relationship(
        "CoverLetter",
        back_populates="job",
        foreign_keys="CoverLetter.job_id",
        passive_deletes=True,
    )
    tailored_resume: Mapped[TailoredResume | None] = relationship(
        "TailoredResume",
        back_populates="job",
        cascade="all, delete-orphan",
        uselist=False,
    )
