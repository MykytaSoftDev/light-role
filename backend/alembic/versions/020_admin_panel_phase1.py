"""Admin Panel Phase 1 — admin flag, audit log, impersonation hooks.

Revision ID: 020
Revises: 019
Create Date: 2026-05-13 00:00:00.000000

Phase 1 of the admin panel (SPEC-admin-panel-phase1.md).

Changes
-------
1. Add ``users.is_admin`` (BOOLEAN, default false) with a partial index
   ``ix_users_is_admin`` covering only rows where ``is_admin = true``.
   Admins are a tiny fraction of total rows, so a partial index keeps
   storage and write-amplification negligible while still satisfying
   "list all admins" lookups (SPEC §4.1).

2. Add ``users.last_login_at`` (TIMESTAMP NULL). The users table didn't
   previously track this — bundled into the admin migration per SPEC §4.7
   so the admin Users list can display "Last login" without an extra
   migration round-trip.

3. Create ``admin_audit_logs`` — an append-only ledger of every
   admin-initiated mutation (subscription grants, impersonation
   start/stop, manual usage resets, ...). The FK constraints encode the
   retention policy:
     - ``admin_id ON DELETE RESTRICT`` — deleting an admin who has
       audit history fails loudly. Self-delete via Settings is already
       gated for non-admins.
     - ``target_user_id ON DELETE SET NULL`` — GDPR-compatible: when a
       user deletes their account we keep the audit row but null out
       the FK.
   Three indexes mirror the dominant read patterns: by admin (audit
   trail for a given admin), by target user (user-detail audit card),
   and by ``created_at DESC`` (global audit feed, newest-first).

4. Add ``usage_log.impersonator_id`` (UUID NULL, FK → users) per SPEC
   §6.8. When NOT NULL the row was generated during an impersonation
   session and must be EXCLUDED from the target user's quota count
   (filter: ``impersonator_id IS NULL``). Default NULL for backfill.

5. Bootstrap initial admins from the ``INITIAL_ADMIN_EMAILS`` env var
   (comma-separated). For each email (stripped + lowercased + non-empty)
   flips ``is_admin = true``. If the env var is missing/empty we log a
   warning and return — the migration is still considered successful so
   it can be re-applied once a target user has registered, or the flag
   can be flipped manually with a UPDATE.

Note on naming: the SPEC §6.8 references ``usage_logs`` (plural) when
adding ``impersonator_id``. The actual table is ``usage_log`` (singular,
since migration 015) — the column is added to the singular table to
match the existing schema.
"""
import logging
import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. users.is_admin + partial index.
    # ------------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_users_is_admin",
        "users",
        ["is_admin"],
        postgresql_where=sa.text("is_admin = true"),
    )

    # ------------------------------------------------------------------
    # 2. users.last_login_at (SPEC §4.7 — bundled here).
    # ------------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=False),
            nullable=True,
        ),
    )

    # ------------------------------------------------------------------
    # 3. admin_audit_logs table + indexes.
    # ------------------------------------------------------------------
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "admin_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "target_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column(
            "payload",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_admin_audit_logs_admin_id",
        "admin_audit_logs",
        ["admin_id"],
    )
    op.create_index(
        "ix_admin_audit_logs_target_user_id",
        "admin_audit_logs",
        ["target_user_id"],
    )
    op.create_index(
        "ix_admin_audit_logs_created_at",
        "admin_audit_logs",
        [sa.text("created_at DESC")],
    )

    # ------------------------------------------------------------------
    # 4. usage_log.impersonator_id (SPEC §6.8).
    # ------------------------------------------------------------------
    op.add_column(
        "usage_log",
        sa.Column(
            "impersonator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ------------------------------------------------------------------
    # 5. Bootstrap initial admins from INITIAL_ADMIN_EMAILS.
    # ------------------------------------------------------------------
    raw = os.getenv("INITIAL_ADMIN_EMAILS", "")
    emails = [e.strip().lower() for e in raw.split(",") if e.strip()]
    if not emails:
        logger.warning(
            "INITIAL_ADMIN_EMAILS is empty or unset — no users were "
            "promoted to admin. Set the env var and re-run the migration, "
            "or update users.is_admin manually."
        )
        return

    op.execute(
        sa.text(
            "UPDATE users SET is_admin = true "
            "WHERE LOWER(email) = ANY(:emails)"
        ).bindparams(sa.bindparam("emails", emails, expanding=True))
    )


def downgrade() -> None:
    # Reverse order of upgrade().
    # 4. Drop impersonator_id from usage_log.
    op.drop_column("usage_log", "impersonator_id")

    # 3. Drop admin_audit_logs and its indexes.
    op.drop_index(
        "ix_admin_audit_logs_created_at",
        table_name="admin_audit_logs",
    )
    op.drop_index(
        "ix_admin_audit_logs_target_user_id",
        table_name="admin_audit_logs",
    )
    op.drop_index(
        "ix_admin_audit_logs_admin_id",
        table_name="admin_audit_logs",
    )
    op.drop_table("admin_audit_logs")

    # 2. Drop last_login_at.
    op.drop_column("users", "last_login_at")

    # 1. Drop partial index + is_admin column.
    op.drop_index("ix_users_is_admin", table_name="users")
    op.drop_column("users", "is_admin")
