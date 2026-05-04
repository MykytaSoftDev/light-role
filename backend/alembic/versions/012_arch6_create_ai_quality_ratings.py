"""Phase 3.1 ARCH-6 — create ai_quality_ratings table (PRD 6.10)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the `ai_quality_ratings` table.

    Stores user star-ratings (1-5) of AI-tailored resumes per PRD 6.10.
    Write-once per resume (no `updated_at`); the UNIQUE on
    `tailored_resume_id` enforces "exactly one rating per tailored resume".

    Note: `id` has no server-side default. Following project convention
    (see app/models/*.py), the SQLAlchemy model — added in ARCH-10 — supplies
    a Python-side `default=uuid.uuid4`.

    The UNIQUE on `tailored_resume_id` doubles as the lookup index for that
    column, so no separate `ix_*_tailored_resume_id` is created (would be a
    duplicate index). Indexes on `user_id` (per-user lookups) and `rating`
    (analytics queries) are still needed.
    """
    op.create_table(
        "ai_quality_ratings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tailored_resume_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tailored_resumes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "tailored_resume_id",
            name="uq_ai_quality_ratings_tailored_resume_id",
        ),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_ai_quality_ratings_rating",
        ),
    )
    op.create_index(
        "ix_ai_quality_ratings_user_id", "ai_quality_ratings", ["user_id"]
    )
    op.create_index(
        "ix_ai_quality_ratings_rating", "ai_quality_ratings", ["rating"]
    )


def downgrade() -> None:
    op.drop_table("ai_quality_ratings")
