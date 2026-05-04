"""Phase 3.1 ARCH-8 — restructure plans table for three-tier monetization (PRD 6.8)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restructure the `plans` table for the new three-tier model
    (Free / Pro / Unlimited) per PRD 6.8.

    Per task ARCH-8: this migration only reshapes schema. Seeding of the
    three plans happens in Phase 5.1. Existing plan rows are deleted to
    guarantee a clean reseed; subscriptions are wiped first to avoid
    dangling FKs (safe per task spec — no production data exists yet).
    """
    # ------------------------------------------------------------------
    # 1. Wipe dependent + target rows so NOT NULL adds and column type
    #    changes don't fight existing data. Subscriptions FIRST because
    #    subscriptions.plan_id references plans.id.
    # ------------------------------------------------------------------
    op.execute("DELETE FROM subscriptions")
    op.execute("DELETE FROM plans")

    # ------------------------------------------------------------------
    # 2. Drop old indexes that reference soon-to-be-renamed columns.
    # ------------------------------------------------------------------
    op.drop_index("ix_plan_slug", table_name="plans")

    # ------------------------------------------------------------------
    # 3. Rename columns to match PRD 6.8.
    # ------------------------------------------------------------------
    # slug -> code, also resize VARCHAR(50) -> VARCHAR(20).
    op.alter_column(
        "plans",
        "slug",
        new_column_name="code",
        existing_type=sa.String(50),
        type_=sa.String(20),
        existing_nullable=False,
    )
    # has_analytics -> analytics_enabled, drop the FALSE server_default
    # (target spec doesn't show one; defaults will come from seed in 5.1).
    op.alter_column(
        "plans",
        "has_analytics",
        new_column_name="analytics_enabled",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        existing_server_default=sa.text("false"),
        server_default=None,
    )
    # sort_order -> display_order, drop the "0" server_default.
    op.alter_column(
        "plans",
        "sort_order",
        new_column_name="display_order",
        existing_type=sa.Integer(),
        existing_nullable=False,
        existing_server_default=sa.text("0"),
        server_default=None,
    )

    # ------------------------------------------------------------------
    # 4. Drop columns no longer in the target schema.
    # ------------------------------------------------------------------
    op.drop_column("plans", "currency")
    op.drop_column("plans", "max_ai_ops_monthly")
    op.drop_column("plans", "max_resume_templates")
    op.drop_column("plans", "has_priority_ai")
    op.drop_column("plans", "features_json")

    # ------------------------------------------------------------------
    # 5. max_active_jobs becomes nullable (NULL = unlimited per PRD 6.8).
    # ------------------------------------------------------------------
    op.alter_column(
        "plans",
        "max_active_jobs",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # 6. Add the new per-credit columns (NULL = unlimited).
    # ------------------------------------------------------------------
    op.add_column(
        "plans",
        sa.Column("resume_credits_per_cycle", sa.Integer(), nullable=True),
    )
    op.add_column(
        "plans",
        sa.Column("cl_credits_per_cycle", sa.Integer(), nullable=True),
    )

    # ------------------------------------------------------------------
    # 7. Recreate the unique index on the renamed `code` column.
    # ------------------------------------------------------------------
    op.create_index("ix_plan_code", "plans", ["code"], unique=True)

    # ------------------------------------------------------------------
    # 8. Resize paddle price ID columns 255 -> 100 per target spec.
    #    Safe because rows are wiped above.
    # ------------------------------------------------------------------
    op.alter_column(
        "plans",
        "paddle_price_id_monthly",
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=True,
    )
    op.alter_column(
        "plans",
        "paddle_price_id_annual",
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=True,
    )


def downgrade() -> None:
    """Reverse ARCH-8 to restore the pre-migration `plans` shape."""
    # ------------------------------------------------------------------
    # 1. Resize paddle price ID columns back to 255.
    # ------------------------------------------------------------------
    op.alter_column(
        "plans",
        "paddle_price_id_annual",
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=True,
    )
    op.alter_column(
        "plans",
        "paddle_price_id_monthly",
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=True,
    )

    # ------------------------------------------------------------------
    # 2. Drop the unique index on `code` (will be recreated on `slug`
    #    after the rename below).
    # ------------------------------------------------------------------
    op.drop_index("ix_plan_code", table_name="plans")

    # ------------------------------------------------------------------
    # 3. Drop the new credit columns.
    # ------------------------------------------------------------------
    op.drop_column("plans", "cl_credits_per_cycle")
    op.drop_column("plans", "resume_credits_per_cycle")

    # ------------------------------------------------------------------
    # 4. Make max_active_jobs NOT NULL again. Backfill any NULLs first
    #    (defensive: shouldn't be any if seed was run, but handle it).
    # ------------------------------------------------------------------
    op.execute(
        "UPDATE plans SET max_active_jobs = 0 WHERE max_active_jobs IS NULL"
    )
    op.alter_column(
        "plans",
        "max_active_jobs",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # 5. Re-add the columns that were dropped, with their original
    #    defaults so any existing rows backfill cleanly.
    # ------------------------------------------------------------------
    op.add_column(
        "plans",
        sa.Column(
            "features_json",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "plans",
        sa.Column(
            "has_priority_ai",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "plans",
        sa.Column(
            "max_resume_templates",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    # max_resume_templates has no original server_default; drop it
    # after backfill so the resulting column matches the pre-014 shape.
    op.alter_column("plans", "max_resume_templates", server_default=None)

    op.add_column(
        "plans",
        sa.Column(
            "max_ai_ops_monthly",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.alter_column("plans", "max_ai_ops_monthly", server_default=None)

    op.add_column(
        "plans",
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="USD",
        ),
    )

    # ------------------------------------------------------------------
    # 6. Reverse the renames.
    # ------------------------------------------------------------------
    op.alter_column(
        "plans",
        "display_order",
        new_column_name="sort_order",
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=sa.text("0"),
    )
    op.alter_column(
        "plans",
        "analytics_enabled",
        new_column_name="has_analytics",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("false"),
    )
    op.alter_column(
        "plans",
        "code",
        new_column_name="slug",
        existing_type=sa.String(20),
        type_=sa.String(50),
        existing_nullable=False,
    )

    # ------------------------------------------------------------------
    # 7. Recreate the unique index on `slug`.
    # ------------------------------------------------------------------
    op.create_index("ix_plan_slug", "plans", ["slug"], unique=True)
