"""Phase 3.1 ARCH-7 — add resume_preferences + complete_steps_dismissed_at to users (PRD 6.3)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Default for users.resume_preferences per PRD 6.3.
# Stored as a server_default so the NOT NULL add-column backfills any
# existing user rows automatically (Postgres applies server_default to
# pre-existing rows when adding a NOT NULL column with a default).
RESUME_PREFERENCES_DEFAULT = (
    '{"sections_order": ["summary", "employment", "education", "projects", '
    '"skills", "certificates", "languages", "achievements", "volunteer"], '
    '"font": "Inter", "template": "classic"}'
)


def upgrade() -> None:
    """Add `resume_preferences` (JSONB, NOT NULL) and `complete_steps_dismissed_at`
    (TIMESTAMP, nullable) to the `users` table per PRD 6.3.
    """
    op.add_column(
        "users",
        sa.Column(
            "resume_preferences",
            JSONB(),
            nullable=False,
            server_default=sa.text(f"'{RESUME_PREFERENCES_DEFAULT}'::jsonb"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "complete_steps_dismissed_at",
            sa.DateTime(timezone=False),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "complete_steps_dismissed_at")
    op.drop_column("users", "resume_preferences")
