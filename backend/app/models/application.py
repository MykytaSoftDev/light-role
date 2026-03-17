from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum as SAEnum, ForeignKey, Index, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ApplicationStatus

if TYPE_CHECKING:
    from app.models.cover_letter import CoverLetter
    from app.models.job import Job
    from app.models.resume import Resume


class Application(TimestampMixin, Base):
    __tablename__ = "applications"

    __table_args__ = (
        CheckConstraint(
            "excitement_level >= 1 AND excitement_level <= 5",
            name="ck_excitement_level",
        ),
        Index("ix_application_job_id", "job_id", unique=True),
        Index("ix_application_status", "status"),
        Index("ix_application_follow_up", "follow_up_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "resumes.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_application_resume",
        ),
        nullable=True,
    )
    cover_letter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "cover_letters.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_application_cover_letter",
        ),
        nullable=True,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(ApplicationStatus, name="applicationstatus", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=ApplicationStatus.SAVED,
        server_default=ApplicationStatus.SAVED.value,
    )
    date_applied: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )
    follow_up_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )
    excitement_level: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    job: Mapped[Job] = relationship(
        "Job",
        back_populates="application",
    )
    resume: Mapped[Resume | None] = relationship(
        "Resume",
        back_populates="applications",
        foreign_keys=[resume_id],
    )
    cover_letter: Mapped[CoverLetter | None] = relationship(
        "CoverLetter",
        back_populates="applications",
        foreign_keys=[cover_letter_id],
    )
