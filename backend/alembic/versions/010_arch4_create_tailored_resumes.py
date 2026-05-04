"""Phase 3.1 ARCH-4 — create tailored_resumes table (PRD 6.5)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the `tailored_resumes` table.

    Snapshot-based per-job tailored resume (PRD 6.5). Each row stores a
    point-in-time snapshot of the user's profile, sections order, font, and
    template at the moment the resume was tailored — so subsequent profile
    edits do not retroactively change historical tailored resumes.

    Note: `id` has no server-side default. Following project convention
    (see app/models/*.py), the SQLAlchemy model — added in ARCH-10 — supplies
    a Python-side `default=uuid.uuid4`. The compound UNIQUE on
    (user_id, job_id) enforces "one tailored resume per (user, job)"; the
    single-column ix_tailored_resumes_user_id and ix_tailored_resumes_job_id
    indexes are still needed for fast independent lookups by user or by job.
    """
    op.create_table(
        "tailored_resumes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("profile_snapshot", JSONB(), nullable=False),
        sa.Column("tailored_data", JSONB(), nullable=False),
        sa.Column("matched_keywords", JSONB(), nullable=False),
        sa.Column("applied_changes", JSONB(), nullable=False),
        sa.Column("match_score", sa.SmallInteger(), nullable=False),
        sa.Column("sections_order_snapshot", JSONB(), nullable=False),
        sa.Column("font_snapshot", sa.String(50), nullable=False),
        sa.Column("template_snapshot", sa.String(50), nullable=False),
        sa.Column(
            "rating_modal_shown_at",
            sa.DateTime(timezone=False),
            nullable=True,
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
        sa.UniqueConstraint(
            "user_id", "job_id", name="uq_tailored_resumes_user_job"
        ),
        sa.CheckConstraint(
            "match_score >= 0 AND match_score <= 100",
            name="ck_tailored_resumes_match_score",
        ),
    )
    op.create_index(
        "ix_tailored_resumes_user_id", "tailored_resumes", ["user_id"]
    )
    op.create_index(
        "ix_tailored_resumes_job_id", "tailored_resumes", ["job_id"]
    )


def downgrade() -> None:
    op.drop_table("tailored_resumes")
