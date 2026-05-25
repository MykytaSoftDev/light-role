"""add params JSONB column to notifications

Revision ID: 022
Revises: 021
Create Date: 2026-05-25 00:00:00.000000

Notifications are being localized on the frontend. Rather than persisting
pre-rendered English copy as the only representation, each notification now
also carries a structured ``params`` payload keyed off ``type``. The
frontend renders localized strings from ``type`` + ``params``; the existing
``title``/``message`` columns stay populated as an English fallback.

The column is nullable with no backfill — pre-existing notifications simply
fall back to their stored ``title``/``message`` on the frontend.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("params", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notifications", "params")
