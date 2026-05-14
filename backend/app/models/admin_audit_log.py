from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AdminAuditLog(Base):
    """Append-only audit trail of every admin-initiated mutation.

    Each row records a single action taken by an admin (subscription
    grants, manual cancellations, AI-op resets, impersonation
    start/stop, ...). Inserted in the SAME transaction as the mutation
    itself so the ledger never diverges from reality — if the audit
    insert fails the underlying action rolls back.

    Foreign-key semantics (encoded in migration 020):

      * ``admin_id`` — ``ON DELETE RESTRICT``. Deleting an admin who
        has audit history fails loudly; admin accounts are not meant
        to be removed through the normal Settings → Delete Account
        flow (that path is gated for non-admins only).

      * ``target_user_id`` — ``ON DELETE SET NULL``. When a regular
        user deletes their account, the audit row is preserved for
        forensics but the FK is nulled out (GDPR-compatible).

    ``action`` is a plain ``VARCHAR(64)`` rather than an enum so new
    action types can be introduced without an ALTER TYPE migration.
    The canonical whitelist lives in ``app.constants.admin_actions``
    (see SPEC §4.2 — added in a later step of Phase 1).

    Never UPDATE or DELETE rows; treat as append-only. No TTL / cleanup
    job is scheduled in Phase 1 (SPEC §9 — Audit log retention).
    """

    __tablename__ = "admin_audit_logs"

    __table_args__ = (
        Index("ix_admin_audit_logs_admin_id", "admin_id"),
        Index("ix_admin_audit_logs_target_user_id", "target_user_id"),
        Index(
            "ix_admin_audit_logs_created_at",
            text("created_at DESC"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    # Two FKs reference users.id, so each relationship must declare its
    # own ``foreign_keys=...`` to disambiguate the join condition.
    admin: Mapped[User] = relationship(
        "User",
        back_populates="admin_audit_logs_authored",
        foreign_keys=[admin_id],
    )
    target_user: Mapped[User | None] = relationship(
        "User",
        back_populates="admin_audit_logs_received",
        foreign_keys=[target_user_id],
    )
