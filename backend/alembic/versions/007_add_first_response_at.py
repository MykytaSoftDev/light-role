"""add first_response_at to applications

Revision ID: 007
Revises: 006
Create Date: 2026-04-15 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column(
            "first_response_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Backfill: set first_response_at = updated_at for applications that have
    # already progressed past 'applied' and have a date_applied value.
    op.execute(
        sa.text(
            """
            UPDATE applications
            SET first_response_at = updated_at
            WHERE status NOT IN ('saved', 'applied')
              AND date_applied IS NOT NULL
              AND first_response_at IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("applications", "first_response_at")
