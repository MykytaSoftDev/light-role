"""add resume_ready to notificationtype enum

Revision ID: 017
Revises: 016
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'resume_ready'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
