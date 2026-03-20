"""add resume_analysis_complete to notificationtype enum

Revision ID: 003
Revises: 002
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE IF NOT EXISTS is idempotent and safe to re-run
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'resume_analysis_complete'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
