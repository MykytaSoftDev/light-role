"""drop resume_analysis_complete from notificationtype enum

Revision ID: 023
Revises: 022
Create Date: 2026-05-25 00:00:00.000000

The ``resume_analysis_complete`` value (added in migration 003) is dead: no
code path creates a notification of that type and no rows in ``notifications``
hold it. PostgreSQL has no ``ALTER TYPE ... DROP VALUE``, so the enum is
recreated without the value and the column is recast onto the new type.

The ``notificationtype`` enum is used only by ``notifications.type`` (NOT NULL,
no server_default), so no default juggling is required. The ``USING`` cast
fails loudly if any row still held the removed value rather than silently
dropping data.

downgrade() re-adds the value via ADD VALUE (mirroring migration 003); note
this appends it at the end of the enum order, which is acceptable.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype RENAME TO notificationtype_old")
    op.execute(
        "CREATE TYPE notificationtype AS ENUM ("
        "'follow_up', 'inactivity', 'limit_warning', 'limit_reset', "
        "'resume_ready', 'cover_letter_ready')"
    )
    op.execute(
        "ALTER TABLE notifications ALTER COLUMN type TYPE notificationtype "
        "USING type::text::notificationtype"
    )
    op.execute("DROP TYPE notificationtype_old")


def downgrade() -> None:
    # Re-add the value so the migration is reversible. ADD VALUE appends it at
    # the end of the enum order, which is fine.
    op.execute(
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'resume_analysis_complete'"
    )
