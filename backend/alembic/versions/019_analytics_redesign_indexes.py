"""Analytics redesign — application_status_history table + analytics indexes.

Revision ID: 019
Revises: 018
Create Date: 2026-05-10 00:00:00.000000

Phase 1 of the analytics page redesign (SPEC-analytics-redesign.md).

Changes
-------
1. Create the ``application_status_history`` table — an append-only
   ledger of every application status transition, denormalizing
   ``user_id`` so analytics queries don't need a two-hop join through
   ``applications -> jobs``. Powers the cumulative funnel
   (SPEC §4.4), the interview/offer KPI sparklines (SPEC §4.6), and
   the ``status_change_*`` events in the activity feed (SPEC §4.8).

2. Backfill one row per existing application capturing its current
   status as the initial save event (``from_status = NULL``,
   ``to_status = applications.status``,
   ``created_at = applications.created_at``). This lets the analytics
   service treat the ledger as authoritative from day one without a
   feature-flagged dual-read.

3. Add the composite analytics index
   ``idx_usage_logs_user_op_created`` on
   ``usage_log (user_id, operation_type, created_at DESC)``. The
   existing ``ix_usage_log_user_id_created_at`` does not include
   ``operation_type`` and so does not satisfy quota/analytics queries
   that filter by both user and operation. The DESC ordering on
   ``created_at`` matches the activity-feed read pattern.

Note on naming: the SPEC §2.1 references ``usage_logs`` (plural) and
``idx_usage_logs_*``. The actual table is ``usage_log`` (singular,
since migration 015) — but the SPEC's index NAME is preserved as-is
to keep grep-ability with the spec document. The index is created
ON the singular table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Reference to the existing PG ENUM created in migration 001 for the
# applications.status column. We reuse it for from_status / to_status
# without recreating the type (create_type=False).
application_status_enum = ENUM(
    "saved",
    "applied",
    "screening",
    "interview",
    "offer",
    "accepted",
    "rejected",
    "withdrawn",
    name="applicationstatus",
    create_type=False,
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create the application_status_history table.
    # ------------------------------------------------------------------
    op.create_table(
        "application_status_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "application_id",
            UUID(as_uuid=True),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_status",
            application_status_enum,
            nullable=True,
        ),
        sa.Column(
            "to_status",
            application_status_enum,
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_application_status_history_application_id",
        "application_status_history",
        ["application_id"],
    )
    op.create_index(
        "idx_status_history_user_created",
        "application_status_history",
        ["user_id", sa.text("created_at DESC")],
    )

    # ------------------------------------------------------------------
    # 2. Backfill one row per existing application as the initial save
    #    event. Uses the application's own created_at so the ledger
    #    timestamps line up with the application's lifecycle, and pulls
    #    user_id from the parent job (the canonical source of ownership
    #    pre-denormalization).
    # ------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO application_status_history
            (id, application_id, user_id, from_status, to_status, created_at)
        SELECT
            gen_random_uuid(),
            a.id,
            j.user_id,
            NULL,
            a.status,
            a.created_at
        FROM applications a
        JOIN jobs j ON j.id = a.job_id
        """
    )

    # ------------------------------------------------------------------
    # 3. Composite index on usage_log for analytics + quota queries.
    # ------------------------------------------------------------------
    op.create_index(
        "idx_usage_logs_user_op_created",
        "usage_log",
        ["user_id", "operation_type", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    # 1. Drop the analytics composite index on usage_log.
    op.drop_index("idx_usage_logs_user_op_created", table_name="usage_log")

    # 2. Drop the status history table (indexes drop automatically).
    op.drop_index(
        "idx_status_history_user_created",
        table_name="application_status_history",
    )
    op.drop_index(
        "ix_application_status_history_application_id",
        table_name="application_status_history",
    )
    op.drop_table("application_status_history")
