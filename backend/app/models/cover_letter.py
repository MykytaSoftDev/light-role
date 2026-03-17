from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CLLength, CLStyle, CLTone

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.job import Job
    from app.models.resume import Resume
    from app.models.user import User


class CoverLetter(TimestampMixin, Base):
    __tablename__ = "cover_letters"

    __table_args__ = (
        Index("ix_cover_letter_user_id", "user_id"),
        Index("ix_cover_letter_job_id", "job_id"),
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
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default="",
    )
    variants: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    selected_variant_index: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    style: Mapped[CLStyle] = mapped_column(
        SAEnum(CLStyle, name="clstyle", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=CLStyle.JOB_MATCHED,
        server_default=CLStyle.JOB_MATCHED.value,
    )
    tone: Mapped[CLTone] = mapped_column(
        SAEnum(CLTone, name="cltone", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=CLTone.CONFIDENT,
        server_default=CLTone.CONFIDENT.value,
    )
    length_setting: Mapped[CLLength] = mapped_column(
        SAEnum(CLLength, name="cllength", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=CLLength.MEDIUM,
        server_default=CLLength.MEDIUM.value,
    )
    additional_context: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    file_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="cover_letters",
    )
    job: Mapped[Job | None] = relationship(
        "Job",
        back_populates="cover_letters",
        foreign_keys=[job_id],
    )
    resume: Mapped[Resume | None] = relationship(
        "Resume",
        back_populates="cover_letters",
        foreign_keys=[resume_id],
    )
    applications: Mapped[List[Application]] = relationship(
        "Application",
        back_populates="cover_letter",
        foreign_keys="Application.cover_letter_id",
        passive_deletes=True,
    )
