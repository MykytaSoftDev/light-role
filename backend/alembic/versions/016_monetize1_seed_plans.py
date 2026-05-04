"""Phase 5.1 MONETIZE-1 — seed Free / Pro / Unlimited plan rows (PRD 6.8).

Migration 014 (ARCH-8) restructured the `plans` table for the three-tier
model and wiped existing rows, leaving the table empty. This migration
seeds the three canonical plan rows so authentication/registration (and
any other code that does `Plan.query.filter(code=...).first()`) works on
a fresh database after `alembic upgrade head`.

Paddle price IDs are sourced from environment variables at migration time
and stored as NULL when the env var is unset or empty. This matches the
pattern established in migration 005.
"""
import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Hard-coded UUIDs for seed rows so downgrade/re-upgrade is deterministic
# and tests can reference plans by a stable ID.
# ---------------------------------------------------------------------------
_FREE_PLAN_ID = "00000000-0000-0000-0000-000000000001"
_PRO_PLAN_ID = "00000000-0000-0000-0000-000000000002"
_UNLIMITED_PLAN_ID = "00000000-0000-0000-0000-000000000003"


# Plan codes — also used by downgrade() to scope the DELETE so it doesn't
# wipe any future plans that get added via app-level seeding/admin tools.
_SEEDED_CODES = ("free", "pro", "unlimited")


def upgrade() -> None:
    """Seed the three canonical plan rows per PRD 6.8.

    Uses ON CONFLICT (code) DO NOTHING so reapplying after a manual edit
    doesn't blow up; the unique index `ix_plan_code` was created in 014.
    """
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # Free plan — no Paddle price IDs (free tier is not purchasable).
    # ------------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            INSERT INTO plans (
                id, name, code, description,
                paddle_price_id_monthly, paddle_price_id_annual,
                price_monthly_cents, price_annual_cents,
                max_active_jobs, resume_credits_per_cycle, cl_credits_per_cycle,
                analytics_enabled, display_order, is_active
            ) VALUES (
                :id, 'Free', 'free',
                'Get started with essential job tracking features.',
                NULL, NULL,
                0, 0,
                10, 3, 3,
                FALSE, 0, TRUE
            )
            ON CONFLICT (code) DO NOTHING
            """
        ),
        {"id": _FREE_PLAN_ID},
    )

    # ------------------------------------------------------------------
    # Pro plan — Paddle price IDs from env (NULL when env var unset/empty).
    # max_active_jobs = NULL means unlimited (PRD 6.8).
    # ------------------------------------------------------------------
    pro_monthly = os.environ.get("PADDLE_PRICE_ID_PRO_MONTHLY", "")
    pro_annual = os.environ.get("PADDLE_PRICE_ID_PRO_ANNUAL", "")

    bind.execute(
        sa.text(
            """
            INSERT INTO plans (
                id, name, code, description,
                paddle_price_id_monthly, paddle_price_id_annual,
                price_monthly_cents, price_annual_cents,
                max_active_jobs, resume_credits_per_cycle, cl_credits_per_cycle,
                analytics_enabled, display_order, is_active
            ) VALUES (
                :id, 'Pro', 'pro',
                'For active job seekers — full credits and analytics.',
                NULLIF(:price_monthly, ''), NULLIF(:price_annual, ''),
                900, 8600,
                NULL, 30, 30,
                TRUE, 1, TRUE
            )
            ON CONFLICT (code) DO NOTHING
            """
        ),
        {
            "id": _PRO_PLAN_ID,
            "price_monthly": pro_monthly,
            "price_annual": pro_annual,
        },
    )

    # ------------------------------------------------------------------
    # Unlimited plan — Paddle price IDs from env (NULL when unset/empty).
    # All three limit columns NULL = unlimited (PRD 6.8).
    # ------------------------------------------------------------------
    unlimited_monthly = os.environ.get("PADDLE_PRICE_ID_UNLIMITED_MONTHLY", "")
    unlimited_annual = os.environ.get("PADDLE_PRICE_ID_UNLIMITED_ANNUAL", "")

    bind.execute(
        sa.text(
            """
            INSERT INTO plans (
                id, name, code, description,
                paddle_price_id_monthly, paddle_price_id_annual,
                price_monthly_cents, price_annual_cents,
                max_active_jobs, resume_credits_per_cycle, cl_credits_per_cycle,
                analytics_enabled, display_order, is_active
            ) VALUES (
                :id, 'Unlimited', 'unlimited',
                'For power users — unlimited everything.',
                NULLIF(:price_monthly, ''), NULLIF(:price_annual, ''),
                2300, 22000,
                NULL, NULL, NULL,
                TRUE, 2, TRUE
            )
            ON CONFLICT (code) DO NOTHING
            """
        ),
        {
            "id": _UNLIMITED_PLAN_ID,
            "price_monthly": unlimited_monthly,
            "price_annual": unlimited_annual,
        },
    )


def downgrade() -> None:
    """Remove the three seeded plan rows.

    Scoped by code so any plans added later via app-level tooling are
    preserved. Note: any subscriptions FK-referencing these plans must be
    cleaned up first by the caller — this is a seed-data migration and
    downgrade safety with live subscriptions is not load-bearing here.
    """
    op.execute(
        sa.text("DELETE FROM plans WHERE code IN ('free', 'pro', 'unlimited')")
    )
