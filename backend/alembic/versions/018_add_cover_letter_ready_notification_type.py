"""add cover_letter_ready to notificationtype enum

Revision ID: 018
Revises: 017
Create Date: 2026-05-07 00:00:00.000000

CL-12 (Phase 4 cover-letter): when the CL generation endpoint detects a
client disconnect at AI completion, it creates an in-app notification so
the user can find their way back to the wizard. That notification needs
its own enum value to keep the type taxonomy meaningful for filtering.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'cover_letter_ready'"
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
