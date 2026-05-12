from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ApplicationStatus

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class ApplicationStatusHistory(Base):
    """Append-only ledger of every application status transition.

    Powers analytics features that need historical visibility into the
    funnel — cumulative funnel counts (an application that reached
    ``offer`` should also be counted in ``interview`` / ``screening`` /
    ``applied`` even after moving on), KPI sparklines for
    interviews/offers, and the activity feed (``status_change_*``
    events).

    Insertion contract:
      - The initial row for an application has ``from_status = NULL``
        and ``to_status = <starting status>`` (typically ``saved``).
      - Every subsequent row captures the prior status in
        ``from_status`` and the new status in ``to_status``.
      - ``user_id`` is denormalized (also reachable via
        ``application -> job -> user``) to avoid a two-hop join in
        analytics queries.
      - Rows are written in the same DB transaction as the status
        change itself so the ledger never diverges from
        ``applications.status``.

    Never UPDATE or DELETE rows; treat as append-only.
    """

    __tablename__ = "application_status_history"

    __table_args__ = (
        Index(
            "ix_application_status_history_application_id",
            "application_id",
        ),
        Index(
            "idx_status_history_user_created",
            "user_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[ApplicationStatus | None] = mapped_column(
        SAEnum(
            ApplicationStatus,
            name="applicationstatus",
            values_callable=lambda obj: [e.value for e in obj],
            create_type=False,
        ),
        nullable=True,
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(
            ApplicationStatus,
            name="applicationstatus",
            values_callable=lambda obj: [e.value for e in obj],
            create_type=False,
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    application: Mapped[Application] = relationship(
        "Application",
        back_populates="status_history",
    )
    user: Mapped[User] = relationship(
        "User",
    )
