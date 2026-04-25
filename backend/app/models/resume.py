from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, CheckConstraint, Enum as SAEnum, ForeignKey, Index, SmallInteger, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import FileFormat

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.cover_letter import CoverLetter
    from app.models.job import Job
    from app.models.user import User

_SECTIONS_ORDER_DEFAULT = (
    '\'["summary", "experience", "education", '
    '"skills", "languages", "certifications"]\'::jsonb'
)


class Resume(TimestampMixin, Base):
    __tablename__ = "resumes"

    __table_args__ = (
        CheckConstraint(
            "match_score >= 1 AND match_score <= 100",
            name="ck_match_score",
        ),
        Index("ix_resume_user_id", "user_id"),
        Index("ix_resume_job_id", "job_id"),
        Index(
            "ix_resume_is_base",
            "user_id",
            postgresql_where=text("is_base = TRUE"),
        ),
        Index("ix_resume_content_hash", "user_id", "content_hash"),
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
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    original_file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    original_file_format: Mapped[FileFormat] = mapped_column(
        SAEnum(FileFormat, name="fileformat", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    optimized_file_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    parsed_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    optimized_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    match_score: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    ai_recommendations: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    sections_order: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text(_SECTIONS_ORDER_DEFAULT),
    )
    is_base: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="FALSE",
    )
    template: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="classic",
        server_default="classic",
    )
    content_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="resumes",
    )
    job: Mapped[Job | None] = relationship(
        "Job",
        back_populates="resumes",
        foreign_keys=[job_id],
    )
    applications: Mapped[List[Application]] = relationship(
        "Application",
        back_populates="resume",
        foreign_keys="Application.resume_id",
        passive_deletes=True,
    )
    cover_letters: Mapped[List[CoverLetter]] = relationship(
        "CoverLetter",
        back_populates="resume",
        foreign_keys="CoverLetter.resume_id",
        passive_deletes=True,
    )
