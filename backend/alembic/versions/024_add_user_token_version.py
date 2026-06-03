"""add users.token_version for session revocation (security TASK 3)

Revision ID: 024
Revises: 023
Create Date: 2026-06-02 00:00:00.000000

Adds a per-user ``token_version`` integer used for session revocation. The
value is embedded as the ``tv`` claim in every access/refresh/impersonation
token; bumping it invalidates all outstanding tokens for that user on their
next authenticated request.

The column is NOT NULL with a ``server_default`` of ``'0'`` so existing rows
backfill to 0 in a single ALTER (every already-issued token then validates
against tv=0 until its first bump). We keep the server_default in place — it
is harmless and lets future raw INSERTs omit the column safely; the
SQLAlchemy model carries the matching ``default=0`` for ORM-side inserts.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
