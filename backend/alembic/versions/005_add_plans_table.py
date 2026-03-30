"""add plans table and migrate subscription plan column

Revision ID: 005
Revises: 004
Create Date: 2026-03-26 00:00:00.000000

Replaces the subscriptionplan ENUM column on subscriptions with a FK to the
new plans table.  Free and Pro rows are seeded during the upgrade so the
data migration can run inline without external tooling.
"""

import os
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Hard-coded UUIDs for seed rows so downgrade/re-upgrade is deterministic.
# ---------------------------------------------------------------------------
_FREE_PLAN_ID = "00000000-0000-0000-0000-000000000001"
_PRO_PLAN_ID = "00000000-0000-0000-0000-000000000002"


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Create the plans table
    # ------------------------------------------------------------------
    op.create_table(
        "plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("paddle_price_id_monthly", sa.String(255), nullable=True),
        sa.Column("paddle_price_id_annual", sa.String(255), nullable=True),
        sa.Column(
            "price_monthly_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "price_annual_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="USD",
        ),
        sa.Column("max_active_jobs", sa.Integer(), nullable=False),
        sa.Column("max_ai_ops_monthly", sa.Integer(), nullable=False),
        sa.Column("max_resume_templates", sa.Integer(), nullable=False),
        sa.Column(
            "has_analytics",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
        ),
        sa.Column(
            "has_priority_ai",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
        ),
        sa.Column(
            "features_json",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="TRUE",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("slug", name="uq_plans_slug"),
    )
    op.create_index("ix_plan_slug", "plans", ["slug"], unique=True)
    op.create_index(
        "ix_plan_price_id_monthly",
        "plans",
        ["paddle_price_id_monthly"],
        postgresql_where=sa.text("paddle_price_id_monthly IS NOT NULL"),
    )
    op.create_index(
        "ix_plan_price_id_annual",
        "plans",
        ["paddle_price_id_annual"],
        postgresql_where=sa.text("paddle_price_id_annual IS NOT NULL"),
    )

    # ------------------------------------------------------------------
    # 2. Seed Free plan
    # ------------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            INSERT INTO plans (
                id, name, slug, description,
                paddle_price_id_monthly, paddle_price_id_annual,
                price_monthly_cents, price_annual_cents, currency,
                max_active_jobs, max_ai_ops_monthly, max_resume_templates,
                has_analytics, has_priority_ai, features_json,
                sort_order, is_active
            ) VALUES (
                :id, 'Free', 'free',
                'Get started with essential job tracking features.',
                NULL, NULL,
                0, 0, 'USD',
                10, 10, 1,
                FALSE, FALSE,
                '["Job tracking", "AI job parsing (10/mo)", "Resume upload", "Cover letter generation"]'::jsonb,
                0, TRUE
            )
            """
        ),
        {"id": _FREE_PLAN_ID},
    )

    # ------------------------------------------------------------------
    # 3. Seed Pro plan (price IDs from env or empty string)
    # ------------------------------------------------------------------
    pro_price_monthly = os.environ.get("PADDLE_PRICE_ID_MONTHLY", "")
    pro_price_annual = os.environ.get("PADDLE_PRICE_ID_ANNUAL", "")

    bind.execute(
        sa.text(
            """
            INSERT INTO plans (
                id, name, slug, description,
                paddle_price_id_monthly, paddle_price_id_annual,
                price_monthly_cents, price_annual_cents, currency,
                max_active_jobs, max_ai_ops_monthly, max_resume_templates,
                has_analytics, has_priority_ai, features_json,
                sort_order, is_active
            ) VALUES (
                :id, 'Pro', 'pro',
                'Unlimited job tracking and advanced AI features.',
                NULLIF(:price_monthly, ''), NULLIF(:price_annual, ''),
                1200, 9900, 'USD',
                -1, 150, -1,
                TRUE, TRUE,
                '["Unlimited job tracking", "150 AI ops/month", "Unlimited resume templates", "Analytics", "Priority AI"]'::jsonb,
                1, TRUE
            )
            """
        ),
        {
            "id": _PRO_PLAN_ID,
            "price_monthly": pro_price_monthly,
            "price_annual": pro_price_annual,
        },
    )

    # ------------------------------------------------------------------
    # 4. Add plan_id column to subscriptions (nullable for migration)
    # ------------------------------------------------------------------
    op.add_column(
        "subscriptions",
        sa.Column("plan_id", UUID(as_uuid=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # 5. Data migration: map old plan enum value → new plan_id FK
    # ------------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET plan_id = (
                SELECT id FROM plans WHERE slug = subscriptions.plan::text
            )
            """
        )
    )

    # ------------------------------------------------------------------
    # 6. Set plan_id NOT NULL and add FK constraint
    # ------------------------------------------------------------------
    op.alter_column("subscriptions", "plan_id", nullable=False)
    op.create_foreign_key(
        "fk_subscription_plan_id",
        "subscriptions",
        "plans",
        ["plan_id"],
        ["id"],
    )

    # ------------------------------------------------------------------
    # 7. Drop the old plan column
    # ------------------------------------------------------------------
    op.drop_column("subscriptions", "plan")

    # ------------------------------------------------------------------
    # 8. Drop the subscriptionplan enum type
    # ------------------------------------------------------------------
    bind.execute(sa.text("DROP TYPE IF EXISTS subscriptionplan"))


def downgrade() -> None:
    bind = op.get_bind()

    # Recreate the subscriptionplan enum
    bind.execute(
        sa.text(
            "CREATE TYPE subscriptionplan AS ENUM ('free', 'pro')"
        )
    )

    # Re-add the plan column (nullable initially for data backfill)
    op.add_column(
        "subscriptions",
        sa.Column(
            "plan",
            sa.Enum("free", "pro", name="subscriptionplan", create_type=False),
            nullable=True,
        ),
    )

    # Backfill plan from the plans slug via plan_id FK
    bind.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET plan = (
                SELECT slug FROM plans WHERE plans.id = subscriptions.plan_id
            )::subscriptionplan
            """
        )
    )

    # Set NOT NULL
    op.alter_column("subscriptions", "plan", nullable=False)

    # Drop the FK constraint and plan_id column
    op.drop_constraint("fk_subscription_plan_id", "subscriptions", type_="foreignkey")
    op.drop_column("subscriptions", "plan_id")

    # Drop plans table and its indexes
    op.drop_index("ix_plan_price_id_annual", table_name="plans")
    op.drop_index("ix_plan_price_id_monthly", table_name="plans")
    op.drop_index("ix_plan_slug", table_name="plans")
    op.drop_table("plans")
