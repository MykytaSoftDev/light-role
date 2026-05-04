"""Phase 3.1 ARCH-3 — create user_profiles table (PRD 6.4)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the `user_profiles` table.

    Single source of truth for the user's career data (one row per user).
    `profile_data` is a JSONB blob whose schema is documented in PRD 6.4 and
    validated structurally by Pydantic on the backend.

    Note: `id` has no server-side default. Following project convention
    (see app/models/*.py), the SQLAlchemy model — added in ARCH-10 — supplies
    a Python-side `default=uuid.uuid4`. Indexing: PRD specifies that the
    UNIQUE constraint on `user_id` doubles as the index, so we deliberately
    do NOT create a separate `ix_user_profiles_user_id`.
    """
    op.create_table(
        "user_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "profile_data",
            JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", name="uq_user_profiles_user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
