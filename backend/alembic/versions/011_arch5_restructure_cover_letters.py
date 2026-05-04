"""Phase 3.1 ARCH-5 — restructure cover_letters: add source_type + source_snapshot (PRD 6.6)."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restructure `cover_letters` per PRD 6.6.

    Three concerns combined into one migration (single destructive cutover
    per PRD 6.13):

    A. Add `source_type` + `source_snapshot` (polymorphic source).
       - `source_type` — discriminator: 'tailored_resume' | 'profile'
       - `source_snapshot` — JSONB point-in-time copy of whichever source
         was used at generation time (so later edits to the profile or
         tailored resume don't retroactively change the cover letter's
         provenance)

    B. Add UNIQUE (user_id, job_id) — PRD 6.6 + PRD 3.5 cardinality
       "1 Job = 1 CoverLetter". Naming convention matches migration 010
       (`uq_tailored_resumes_user_job`).

    C. Convert `content` from TEXT to JSONB — PRD 6.6 defines content as
       JSONB (Tiptap document) and PRD 6.13 step 6 calls for the reshape.

    Order:
      1. Add nullable source_type / source_snapshot
      2. Backfill, then ALTER NOT NULL
      3. CHECK on source_type
      4. Dedupe (user_id, job_id) THEN add UNIQUE
      5. content TEXT -> JSONB (with safe Tiptap-wrap CASE expression)

    Dedupe runs BEFORE the UNIQUE so the constraint creation can't blow
    up if any straggler test rows share a (user_id, job_id) pair. On a
    wiped dev DB it's a no-op.
    """
    # 1. Add columns as nullable so backfill can run safely. ----------------
    op.add_column(
        "cover_letters",
        sa.Column("source_type", sa.String(20), nullable=True),
    )
    op.add_column(
        "cover_letters",
        sa.Column("source_snapshot", JSONB(), nullable=True),
    )

    # 2. Backfill any pre-existing rows with the documented defaults. -------
    # No-op on a wiped dev DB; safety net for environments that may have
    # data lingering from earlier work.
    op.execute(
        "UPDATE cover_letters "
        "SET source_type = 'profile', source_snapshot = '{}'::jsonb "
        "WHERE source_type IS NULL"
    )

    # 3. Enforce NOT NULL now that every row has a value. -------------------
    op.alter_column("cover_letters", "source_type", nullable=False)
    op.alter_column("cover_letters", "source_snapshot", nullable=False)

    # 4. Pin the discriminator to the two allowed values. -------------------
    op.create_check_constraint(
        "ck_cover_letters_source_type",
        "cover_letters",
        "source_type IN ('tailored_resume', 'profile')",
    )

    # 5. Dedupe + UNIQUE (user_id, job_id). PRD 6.6 / PRD 3.5. --------------
    # Dedupe MUST precede the unique constraint creation; otherwise the
    # constraint would fail to apply if any duplicate rows snuck in.
    # Keeps the row with the largest id (most recent) per (user, job).
    op.execute(
        """
        DELETE FROM cover_letters a
        USING cover_letters b
        WHERE a.id < b.id AND a.user_id = b.user_id AND a.job_id = b.job_id
        """
    )
    op.create_unique_constraint(
        "uq_cover_letters_user_job",
        "cover_letters",
        ["user_id", "job_id"],
    )

    # 6. content TEXT -> JSONB (PRD 6.6 — Tiptap JSON document). ------------
    # Normalize NULL/empty to a valid JSON object literal first so the
    # CAST in the USING expression cannot fail on those rows.
    op.execute(
        "UPDATE cover_letters "
        "SET content = '{}' "
        "WHERE content IS NULL OR content = ''"
    )
    # USING expression: if the existing TEXT already looks like JSON
    # (starts with '{' or '['), cast it directly; otherwise wrap the
    # plain text into a minimal valid Tiptap doc so we never lose data
    # and never error out on un-parseable content.
    op.alter_column(
        "cover_letters",
        "content",
        existing_type=sa.Text(),
        type_=JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        postgresql_using=(
            "CASE WHEN content::text ~ '^\\s*[{\\[]' "
            "THEN content::jsonb "
            "ELSE jsonb_build_object("
            "'type', 'doc', "
            "'content', jsonb_build_array("
            "jsonb_build_object("
            "'type', 'paragraph', "
            "'content', jsonb_build_array("
            "jsonb_build_object('type', 'text', 'text', content)"
            ")"
            ")"
            ")"
            ") END"
        ),
    )


def downgrade() -> None:
    """Reverse ARCH-5 in strict reverse order of upgrade().

    Order matters:
      6. JSONB -> TEXT
      5. Drop UNIQUE  (no need to "un-dedupe" — data loss is one-way)
      4. Drop CHECK   (references source_type, must precede column drop)
      1+2+3. Drop the two columns
    """
    # Reverse step 6: JSONB -> TEXT (Postgres can cast jsonb to text).
    op.alter_column(
        "cover_letters",
        "content",
        existing_type=JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using="content::text",
    )

    # Reverse step 5: drop the unique constraint.
    op.drop_constraint(
        "uq_cover_letters_user_job",
        "cover_letters",
        type_="unique",
    )

    # Reverse step 4: drop the discriminator CHECK before dropping the column.
    op.drop_constraint(
        "ck_cover_letters_source_type",
        "cover_letters",
        type_="check",
    )

    # Reverse steps 1-3: drop the polymorphic-source columns.
    op.drop_column("cover_letters", "source_snapshot")
    op.drop_column("cover_letters", "source_type")
