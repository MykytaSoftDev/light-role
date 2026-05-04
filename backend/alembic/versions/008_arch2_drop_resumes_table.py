"""ARCH-2 drop legacy resumes table

Revision ID: 008
Revises: 007
Create Date: 2026-05-03 00:00:00.000000

Phase 3.1 ARCH-2 — destructive cleanup. Removes legacy `resumes` table
(replaced by `user_profiles` + `tailored_resumes` in subsequent ARCH-3..4
migrations). Approved because dev DB has no production data.

This migration assumes the legacy schema (resumes table + FK columns on
applications/cover_letters) exists. It is NOT idempotent — it expects to
run in sequence after 007.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

# revision identifiers
revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Enum used only by the (legacy) resumes.original_file_format column.
# Recreated in downgrade() so the rollback is a true inverse.
# ---------------------------------------------------------------------------
file_format_enum = ENUM(
    "pdf", "docx",
    name="fileformat",
    create_type=False,
)


def upgrade() -> None:
    """Drop the legacy resumes table and all references to it.

    Order matters:
      1. Drop FKs that reference resumes.id (so the table can be dropped).
      2. Drop the resume_id columns on cover_letters / applications.
      3. Drop indexes on resumes (drop_table handles these on PG, but we are
         explicit for clarity).
      4. Drop the resumes table itself.
      5. Drop the now-orphaned `fileformat` ENUM type (only the resumes
         table used it — verified via grep across backend/).
    """
    bind = op.get_bind()

    # 1. Drop FKs that point at resumes.id ------------------------------------
    # cover_letters.resume_id was created via inline sa.ForeignKey() with no
    # explicit name, so PostgreSQL assigned the default name
    # `cover_letters_resume_id_fkey`.
    op.drop_constraint(
        "cover_letters_resume_id_fkey",
        "cover_letters",
        type_="foreignkey",
    )
    # applications.resume_id was created with use_alter via op.create_foreign_key
    # using an explicit name in 001_initial_schema.py.
    op.drop_constraint(
        "fk_application_resume",
        "applications",
        type_="foreignkey",
    )

    # 2. Drop the resume_id columns ------------------------------------------
    op.drop_column("cover_letters", "resume_id")
    op.drop_column("applications", "resume_id")

    # 3. Drop indexes on resumes (explicit; drop_table would also clean these)
    op.drop_index("ix_resume_content_hash", table_name="resumes")
    op.drop_index("ix_resume_is_base", table_name="resumes")
    op.drop_index("ix_resume_job_id", table_name="resumes")
    op.drop_index("ix_resume_user_id", table_name="resumes")

    # 4. Drop the resumes table ----------------------------------------------
    op.drop_table("resumes")

    # 5. Drop the now-orphaned `fileformat` ENUM ------------------------------
    # Verified via grep that no other model/table references this enum.
    file_format_enum.drop(bind, checkfirst=True)


def downgrade() -> None:
    """Recreate the resumes table as an EMPTY placeholder with the same
    schema it had at HEAD=007 (i.e. initial schema + content_hash from 002).

    Data is NOT restored — this is a structural rollback only.
    """
    bind = op.get_bind()

    # 1. Recreate the `fileformat` ENUM --------------------------------------
    file_format_enum.create(bind, checkfirst=True)

    # 2. Recreate the resumes table -----------------------------------------
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
        sa.Column("content_hash", sa.String(64), nullable=True),
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
    op.create_index(
        "ix_resume_content_hash",
        "resumes",
        ["user_id", "content_hash"],
    )

    # 3. Re-add resume_id columns to cover_letters and applications ----------
    op.add_column(
        "cover_letters",
        sa.Column("resume_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("resume_id", UUID(as_uuid=True), nullable=True),
    )

    # 4. Re-add the FKs (matching original ON DELETE behavior) ---------------
    # cover_letters.resume_id originally had the auto-generated PG name
    # `cover_letters_resume_id_fkey`; we recreate it with that exact name so
    # a future re-run of upgrade() would still find it.
    op.create_foreign_key(
        "cover_letters_resume_id_fkey",
        "cover_letters",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_application_resume",
        "applications",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )
