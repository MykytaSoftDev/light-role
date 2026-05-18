"""Admin audit log — admin_id SET NULL + admin_email_snapshot.

Revision ID: 021
Revises: 020
Create Date: 2026-05-18 00:00:00.000000

Background
----------
Migration 020 created ``admin_audit_logs.admin_id`` as ``NOT NULL`` with
``ON DELETE RESTRICT``. That was the original "audit trail is sacred"
posture, but it has a hard failure mode: when an admin deletes their
own account (Settings → Delete Account), the cascade hits the audit
table and the RESTRICT FK blocks the delete with an ``IntegrityError``.

The ORM relationship made it worse — ``cascade="save-update, merge"``
without ``passive_deletes=True`` caused SQLAlchemy to auto-emit
``UPDATE admin_audit_logs SET admin_id = NULL`` before the parent
delete, which then violated the ``NOT NULL`` constraint and produced
exactly the failure seen in production.

Decision
--------
Relax the FK to ``ON DELETE SET NULL`` and denormalize the admin's
email at write time into ``admin_email_snapshot``. Audit rows survive
the admin's deletion; the email is preserved verbatim so the audit
UI keeps showing *who* did the action, even after the account is gone.

Changes
-------
1. Add ``admin_audit_logs.admin_email_snapshot VARCHAR(255) NULL``.
2. Backfill ``admin_email_snapshot`` from the current ``users.email``
   for every existing audit row (admin_id is still NOT NULL here, so
   no rows are skipped).
3. Drop the original FK constraint (``admin_audit_logs_admin_id_fkey``
   — Postgres' default name for this constraint).
4. Make ``admin_id`` nullable.
5. Recreate the FK with ``ON DELETE SET NULL``.

The downgrade is destructive: rows with ``admin_id IS NULL`` cannot be
recovered, so the downgrade deletes them before restoring ``NOT NULL``.
This is acceptable for a recovery path — production should never
intentionally roll this back.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add admin_email_snapshot column (nullable so backfill is a
    #    single UPDATE; we never enforce NOT NULL because future rows
    #    where the admin is already deleted can't have a fresh source).
    # ------------------------------------------------------------------
    op.add_column(
        "admin_audit_logs",
        sa.Column(
            "admin_email_snapshot",
            sa.String(length=255),
            nullable=True,
        ),
    )

    # ------------------------------------------------------------------
    # 2. Backfill snapshot from users.email. At this point admin_id is
    #    still NOT NULL and FK-valid, so the join is total.
    # ------------------------------------------------------------------
    op.execute(
        "UPDATE admin_audit_logs l "
        "SET admin_email_snapshot = u.email "
        "FROM users u "
        "WHERE u.id = l.admin_id"
    )

    # ------------------------------------------------------------------
    # 3. Drop the original ON DELETE RESTRICT FK. Postgres' default
    #    constraint name for FK columns is ``<table>_<column>_fkey``.
    # ------------------------------------------------------------------
    op.drop_constraint(
        "admin_audit_logs_admin_id_fkey",
        "admin_audit_logs",
        type_="foreignkey",
    )

    # ------------------------------------------------------------------
    # 4. Make admin_id nullable.
    # ------------------------------------------------------------------
    op.alter_column(
        "admin_audit_logs",
        "admin_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # 5. Recreate FK with ON DELETE SET NULL.
    # ------------------------------------------------------------------
    op.create_foreign_key(
        "admin_audit_logs_admin_id_fkey",
        "admin_audit_logs",
        "users",
        ["admin_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Reverse order of upgrade(). NOTE: this is a destructive path —
    # any audit rows whose admin has since been deleted (admin_id IS
    # NULL) cannot satisfy the restored NOT NULL constraint and must
    # be removed. We accept that loss because this downgrade is only a
    # recovery escape hatch, not a routine operation.

    # 5. Drop the SET NULL FK so we can re-tighten nullability.
    op.drop_constraint(
        "admin_audit_logs_admin_id_fkey",
        "admin_audit_logs",
        type_="foreignkey",
    )

    # Destructive cleanup: orphan rows can't survive NOT NULL.
    op.execute("DELETE FROM admin_audit_logs WHERE admin_id IS NULL")

    # 4. Restore NOT NULL.
    op.alter_column(
        "admin_audit_logs",
        "admin_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
    )

    # 3. Recreate the original RESTRICT FK.
    op.create_foreign_key(
        "admin_audit_logs_admin_id_fkey",
        "admin_audit_logs",
        "users",
        ["admin_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # 1. Drop the snapshot column (no separate step 2 — backfill data
    # disappears with the column).
    op.drop_column("admin_audit_logs", "admin_email_snapshot")
