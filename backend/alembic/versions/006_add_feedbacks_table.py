"""add feedbacks table

Revision ID: 006
Revises: 005
Create Date: 2026-04-13 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define the enum types — create_type=False so op.create_table won't touch them
feedbacktype_enum = postgresql.ENUM(
    "bug", "feature_request", "improvement", "other",
    name="feedbacktype",
    create_type=False,
)
feedbackstatus_enum = postgresql.ENUM(
    "new", "reviewed", "planned", "done", "declined",
    name="feedbackstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # Create enum types with checkfirst=True — idempotent, safe to re-run
    postgresql.ENUM(
        "bug", "feature_request", "improvement", "other",
        name="feedbacktype",
    ).create(bind, checkfirst=True)

    postgresql.ENUM(
        "new", "reviewed", "planned", "done", "declined",
        name="feedbackstatus",
    ).create(bind, checkfirst=True)

    # Create table only if it doesn't already exist
    table_exists = bind.execute(
        sa.text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'feedbacks'"
            ")"
        )
    ).scalar()

    if not table_exists:
        op.create_table(
            "feedbacks",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("type", feedbacktype_enum, nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("page_url", sa.String(500), nullable=True),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column(
                "status",
                feedbackstatus_enum,
                nullable=False,
                server_default="new",
            ),
            sa.Column("admin_notes", sa.Text(), nullable=True),
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
        )

    # Create indexes — IF NOT EXISTS is idempotent
    bind.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_feedback_user_id ON feedbacks (user_id)"
    ))
    bind.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_feedback_status ON feedbacks (status)"
    ))
    bind.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_feedback_created_at ON feedbacks (created_at)"
    ))


def downgrade() -> None:
    op.drop_index("ix_feedback_created_at", table_name="feedbacks")
    op.drop_index("ix_feedback_status", table_name="feedbacks")
    op.drop_index("ix_feedback_user_id", table_name="feedbacks")
    op.drop_table("feedbacks")
    postgresql.ENUM(name="feedbackstatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="feedbacktype").drop(op.get_bind(), checkfirst=True)
