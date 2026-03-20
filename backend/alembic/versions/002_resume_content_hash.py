"""add content_hash to resumes

Revision ID: 002
Revises: 001
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("content_hash", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_resume_content_hash",
        "resumes",
        ["user_id", "content_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_resume_content_hash", table_name="resumes")
    op.drop_column("resumes", "content_hash")
