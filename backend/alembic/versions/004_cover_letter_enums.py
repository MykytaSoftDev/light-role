"""cover letter feature reference migration

Revision ID: 004
Revises: 003
Create Date: 2026-03-20 00:00:00.000000

The cover_letters table and all associated enum types (clstyle, cltone, cllength)
were already created as part of migration 001_initial_schema. This migration is a
no-op reference marker confirming that the cover letter backend feature is complete
and all required schema objects are already present in the database.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # cover_letters table and clstyle/cltone/cllength enum types were created
    # in migration 001_initial_schema — nothing to do here.
    pass


def downgrade() -> None:
    pass
