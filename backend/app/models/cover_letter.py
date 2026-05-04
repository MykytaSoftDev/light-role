from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CLLength, CLStyle, CLTone

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.job import Job
    from app.models.user import User


class CoverLetter(TimestampMixin, Base):
    __tablename__ = "cover_letters"

    __table_args__ = (
        UniqueConstraint(
            "user_id", "job_id", name="uq_cover_letters_user_job"
        ),
        CheckConstraint(
            "source_type IN ('tailored_resume', 'profile')",
            name="ck_cover_letters_source_type",
        ),
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
    # NOTE: PRD 6.6 specifies job_id as NOT NULL, but migration 011 did not
    # alter the column nullability. Keep matching the current DB shape
    # (nullable) until a follow-up migration tightens it.
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    # Tiptap JSON document (PRD 6.6). Migration 011 converted TEXT -> JSONB.
    content: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    # Polymorphic source discriminator (PRD 6.6) — values 'tailored_resume'
    # or 'profile'. CHECK constraint enforced at DB level only.
    source_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    # Point-in-time copy of whichever source was used at generation time
    # (PRD 6.6) so later edits don't retroactively change provenance.
    source_snapshot: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    # NOTE: PRD 6.6 keeps style/tone/length as VARCHAR(50). They currently
    # remain PG ENUMs in the DB (no migration converted them yet). Keep
    # using SAEnum here to match the DB; a future migration will convert.
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
    # NOTE: PRD 6.6 calls this column `length`; current DB column is
    # `length_setting` (from 001_initial_schema). Leave as-is until a
    # follow-up migration renames it.
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
    # DEPRECATED in v2.1 PRD 6.6 — to be removed in a future migration.
    variants: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    # DEPRECATED in v2.1 PRD 6.6 — to be removed in a future migration.
    selected_variant_index: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    # DEPRECATED in v2.1 PRD 6.6 — to be removed in a future migration.
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
    applications: Mapped[List[Application]] = relationship(
        "Application",
        back_populates="cover_letter",
        foreign_keys="Application.cover_letter_id",
        passive_deletes=True,
    )
