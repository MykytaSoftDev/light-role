"""Phase 3.1 ARCH-9 — add subscriptions cycle_anchor_at + scheduled_change; replace usage_logs with usage_log (PRD 6.11, 6.12)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Legacy enum recreated by downgrade() to restore the pre-015 `usage_logs` shape.
operation_type_enum = ENUM(
    "job_parse", "resume_analyze", "cl_generate", "cl_regenerate",
    name="operationtype",
    create_type=False,
)


def upgrade() -> None:
    """Apply ARCH-9 schema changes.

    Part 1: Add `cycle_anchor_at` (NOT NULL) and `scheduled_change` (JSONB,
    NULL) to `subscriptions` per PRD 6.11.

    Part 2: Drop the legacy AI-telemetry `usage_logs` table (and its now
    orphaned `operationtype` PG enum) and create the new business audit
    `usage_log` table per PRD 6.12.
    """
    # ------------------------------------------------------------------
    # PART 1 — subscriptions: add cycle_anchor_at + scheduled_change
    # ------------------------------------------------------------------

    # Add nullable first so the ALTER works even if rows exist.
    # (Migration 014 wiped subscriptions, so this is currently a no-op,
    # but write it defensively for any future reapplication scenario.)
    op.add_column(
        "subscriptions",
        sa.Column(
            "cycle_anchor_at",
            sa.DateTime(timezone=False),
            nullable=True,
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "scheduled_change",
            JSONB(),
            nullable=True,
        ),
    )

    # Backfill cycle_anchor_at from current_period_start, falling back to
    # NOW() if for any reason current_period_start is NULL (defensive —
    # the column is itself NOT NULL today, but kept as a safety net).
    op.execute(
        "UPDATE subscriptions "
        "SET cycle_anchor_at = COALESCE(current_period_start, NOW()) "
        "WHERE cycle_anchor_at IS NULL"
    )

    # Now enforce NOT NULL on cycle_anchor_at.
    op.alter_column(
        "subscriptions",
        "cycle_anchor_at",
        existing_type=sa.DateTime(timezone=False),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # PART 2 — replace usage_logs with usage_log (PRD 6.12)
    # ------------------------------------------------------------------

    # Drop the legacy AI-telemetry table. Indexes are dropped automatically.
    op.drop_table("usage_logs")

    # Drop the now-orphaned `operationtype` PG enum. Verified that no other
    # SQLAlchemy model in app/models references this enum (only usage_log.py
    # did, and that table is now gone). ARCH-10 will rewrite the model to
    # use plain VARCHAR for operation_type.
    bind = op.get_bind()
    operation_type_enum.drop(bind, checkfirst=True)

    # Create the new business audit `usage_log` table per PRD 6.12.
    # operation_type / cost_type / entity_type are plain VARCHAR (NOT a
    # PG enum) so new operation/cost types can be introduced without an
    # ALTER TYPE migration. Pydantic Literal validation in ARCH-11 covers
    # the application-level whitelist.
    op.create_table(
        "usage_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("operation_type", sa.String(30), nullable=False),
        sa.Column("cost_type", sa.String(20), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=True),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_usage_log_user_id_created_at",
        "usage_log",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_usage_log_operation_type",
        "usage_log",
        ["operation_type"],
    )


def downgrade() -> None:
    """Reverse ARCH-9.

    Order:
      1. Drop the new `usage_log` table.
      2. Recreate the legacy `operationtype` PG enum + `usage_logs` table
         with its original 001_initial_schema columns and indexes.
      3. Drop `scheduled_change` from `subscriptions`.
      4. Drop `cycle_anchor_at` from `subscriptions`.
    """
    # ------------------------------------------------------------------
    # 1. Drop the new usage_log table (indexes dropped automatically).
    # ------------------------------------------------------------------
    op.drop_table("usage_log")

    # ------------------------------------------------------------------
    # 2. Recreate the legacy operationtype enum + usage_logs table to
    #    match the original 001_initial_schema shape exactly.
    # ------------------------------------------------------------------
    bind = op.get_bind()
    operation_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "usage_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("operation_type", operation_type_enum, nullable=False),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("tokens_input", sa.Integer(), nullable=True),
        sa.Column("tokens_output", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_usage_log_user_month", "usage_logs", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_usage_log_created_at", "usage_logs", ["created_at"]
    )

    # ------------------------------------------------------------------
    # 3. Drop scheduled_change from subscriptions.
    # ------------------------------------------------------------------
    op.drop_column("subscriptions", "scheduled_change")

    # ------------------------------------------------------------------
    # 4. Drop cycle_anchor_at from subscriptions.
    # ------------------------------------------------------------------
    op.drop_column("subscriptions", "cycle_anchor_at")
