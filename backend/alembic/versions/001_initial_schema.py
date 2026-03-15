"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Enum type objects (create_type=False — we call .create() manually so we
# can control order and use checkfirst=True).
# ---------------------------------------------------------------------------

auth_provider_enum = ENUM(
    "email", "google",
    name="authprovider",
    create_type=False,
)
application_status_enum = ENUM(
    "saved", "applied", "screening", "interview",
    "offer", "accepted", "rejected", "withdrawn",
    name="applicationstatus",
    create_type=False,
)
file_format_enum = ENUM(
    "pdf", "docx",
    name="fileformat",
    create_type=False,
)
operation_type_enum = ENUM(
    "job_parse", "resume_analyze", "cl_generate", "cl_regenerate",
    name="operationtype",
    create_type=False,
)
subscription_plan_enum = ENUM(
    "free", "pro",
    name="subscriptionplan",
    create_type=False,
)
subscription_status_enum = ENUM(
    "active", "cancelled", "past_due",
    name="subscriptionstatus",
    create_type=False,
)
cl_style_enum = ENUM(
    "formal", "professional", "job_matched",
    name="clstyle",
    create_type=False,
)
cl_tone_enum = ENUM(
    "confident", "humble", "enthusiastic",
    name="cltone",
    create_type=False,
)
cl_length_enum = ENUM(
    "short", "medium", "long",
    name="cllength",
    create_type=False,
)
notification_type_enum = ENUM(
    "follow_up", "inactivity", "limit_warning", "limit_reset",
    name="notificationtype",
    create_type=False,
)

ALL_ENUMS = [
    auth_provider_enum,
    application_status_enum,
    file_format_enum,
    operation_type_enum,
    subscription_plan_enum,
    subscription_status_enum,
    cl_style_enum,
    cl_tone_enum,
    cl_length_enum,
    notification_type_enum,
]


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Create all enum types
    # ------------------------------------------------------------------
    for enum in ALL_ENUMS:
        enum.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # 2. users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column(
            "auth_provider",
            auth_provider_enum,
            nullable=False,
            server_default="email",
        ),
        sa.Column("google_id", sa.String(255), nullable=True),
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
        ),
        sa.Column(
            "notification_preferences",
            JSONB(),
            nullable=False,
            server_default=sa.text(
                '\'{"all_enabled": true, "follow_up_reminders": true, '
                '"inactivity_nudges": true, "limit_warnings": true, '
                '"limit_reset": true}\'::jsonb'
            ),
        ),
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
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
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_id", name="uq_users_google_id"),
    )
    op.create_index("ix_user_email", "users", ["email"], unique=True)

    # ------------------------------------------------------------------
    # 3. jobs
    # ------------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("company", sa.String(255), nullable=False),
        sa.Column("description_raw", sa.Text(), nullable=True),
        sa.Column(
            "requirements",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("salary", sa.String(100), nullable=True),
        sa.Column(
            "is_ai_parsed",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
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
    )
    op.create_index("ix_job_user_id", "jobs", ["user_id"])
    op.create_index("ix_job_company", "jobs", ["company"])

    # ------------------------------------------------------------------
    # 4. resumes
    # ------------------------------------------------------------------
    op.create_table(
        "resumes",
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
            sa.ForeignKey("jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("original_file_path", sa.String(500), nullable=False),
        sa.Column("original_file_format", file_format_enum, nullable=False),
        sa.Column("optimized_file_path", sa.String(500), nullable=True),
        sa.Column("parsed_data", JSONB(), nullable=True),
        sa.Column("optimized_data", JSONB(), nullable=True),
        sa.Column("match_score", sa.SmallInteger(), nullable=True),
        sa.Column("ai_recommendations", JSONB(), nullable=True),
        sa.Column(
            "sections_order",
            JSONB(),
            nullable=False,
            server_default=sa.text(
                '\'["personal_info", "summary", "experience", "education", '
                '"skills", "languages", "certifications"]\'::jsonb'
            ),
        ),
        sa.Column(
            "is_base",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
        ),
        sa.Column(
            "template",
            sa.String(50),
            nullable=False,
            server_default="classic",
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
        sa.CheckConstraint(
            "match_score >= 1 AND match_score <= 100",
            name="ck_match_score",
        ),
    )
    op.create_index("ix_resume_user_id", "resumes", ["user_id"])
    op.create_index("ix_resume_job_id", "resumes", ["job_id"])
    op.create_index(
        "ix_resume_is_base",
        "resumes",
        ["user_id"],
        unique=False,
        postgresql_where=sa.text("is_base = TRUE"),
    )

    # ------------------------------------------------------------------
    # 5. cover_letters
    # ------------------------------------------------------------------
    op.create_table(
        "cover_letters",
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
            sa.ForeignKey("jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "resume_id",
            UUID(as_uuid=True),
            sa.ForeignKey("resumes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "variants",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("selected_variant_index", sa.SmallInteger(), nullable=True),
        sa.Column(
            "style",
            cl_style_enum,
            nullable=False,
            server_default="job_matched",
        ),
        sa.Column(
            "tone",
            cl_tone_enum,
            nullable=False,
            server_default="confident",
        ),
        sa.Column(
            "length_setting",
            cl_length_enum,
            nullable=False,
            server_default="medium",
        ),
        sa.Column("additional_context", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
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
    op.create_index("ix_cover_letter_user_id", "cover_letters", ["user_id"])
    op.create_index("ix_cover_letter_job_id", "cover_letters", ["job_id"])

    # ------------------------------------------------------------------
    # 6. applications  (uses use_alter FKs → added after table creation)
    # ------------------------------------------------------------------
    op.create_table(
        "applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("resume_id", UUID(as_uuid=True), nullable=True),
        sa.Column("cover_letter_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            application_status_enum,
            nullable=False,
            server_default="saved",
        ),
        sa.Column("date_applied", sa.DateTime(timezone=False), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=False), nullable=True),
        sa.Column("follow_up_date", sa.DateTime(timezone=False), nullable=True),
        sa.Column("excitement_level", sa.SmallInteger(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint(
            "excitement_level >= 1 AND excitement_level <= 5",
            name="ck_excitement_level",
        ),
    )
    # Deferred FKs for Application → Resume / CoverLetter (use_alter pattern)
    op.create_foreign_key(
        "fk_application_resume",
        "applications",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_application_cover_letter",
        "applications",
        "cover_letters",
        ["cover_letter_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_application_job_id", "applications", ["job_id"], unique=True
    )
    op.create_index("ix_application_status", "applications", ["status"])
    op.create_index(
        "ix_application_follow_up", "applications", ["follow_up_date"]
    )

    # ------------------------------------------------------------------
    # 7. subscriptions
    # ------------------------------------------------------------------
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "plan",
            subscription_plan_enum,
            nullable=False,
            server_default="free",
        ),
        sa.Column(
            "status",
            subscription_status_enum,
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "current_period_start",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "current_period_end",
            sa.DateTime(timezone=False),
            nullable=False,
        ),
        sa.Column("paddle_customer_id", sa.String(255), nullable=True),
        sa.Column("paddle_subscription_id", sa.String(255), nullable=True),
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
    op.create_index(
        "ix_subscription_user_id", "subscriptions", ["user_id"], unique=True
    )
    op.create_index(
        "ix_subscription_paddle_customer",
        "subscriptions",
        ["paddle_customer_id"],
    )

    # ------------------------------------------------------------------
    # 8. usage_logs
    # ------------------------------------------------------------------
    op.create_table(
        "usage_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("operation_type", operation_type_enum, nullable=False),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("tokens_input", sa.Integer(), nullable=True),
        sa.Column("tokens_output", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_usage_log_user_month", "usage_logs", ["user_id", "created_at"]
    )
    op.create_index("ix_usage_log_created_at", "usage_logs", ["created_at"])

    # ------------------------------------------------------------------
    # 9. notifications
    # ------------------------------------------------------------------
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "is_read",
            sa.Boolean(),
            nullable=False,
            server_default="FALSE",
        ),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_notification_user_unread",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
        postgresql_where=sa.text("is_read = FALSE"),
    )
    op.create_index(
        "ix_notification_user_created",
        "notifications",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Drop deferred FKs first
    op.drop_constraint(
        "fk_application_cover_letter", "applications", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_application_resume", "applications", type_="foreignkey"
    )

    # Drop tables in reverse dependency order
    op.drop_table("notifications")
    op.drop_table("usage_logs")
    op.drop_table("subscriptions")
    op.drop_table("applications")
    op.drop_table("cover_letters")
    op.drop_table("resumes")
    op.drop_table("jobs")
    op.drop_table("users")

    # Drop all enum types
    for enum in reversed(ALL_ENUMS):
        enum.drop(bind, checkfirst=True)
