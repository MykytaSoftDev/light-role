"""TailoredResume endpoints (PRD 6.5).

Currently exposes:
  - POST /api/v1/tailored-resumes/{id}/download → PDF stream (TAILOR-3)

The remaining CRUD endpoints (GET / PATCH / DELETE / rating) live in their
own tasks (TAILOR-8, TAILOR-14) and will land in this same router.
"""

from __future__ import annotations

import logging
import re
import uuid
from io import BytesIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.ai_quality_rating import AIQualityRating
from app.models.tailored_resume import TailoredResume
from app.models.user import User
from app.schemas.tailored_resume import (
    AIQualityRatingCreateRequest,
    AIQualityRatingResponse,
    TailoredResumePatchRequest,
    TailoredResumeRatingModalShownResponse,
    TailoredResumeResponse,
)
from app.services.font_css import (
    DEFAULT_FONT,
    get_default_font_stack,
    get_font_face_css,
)
from app.services.pdf_service import (
    PDFRenderError,
    PDFRenderTimeout,
    pdf_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tailored-resumes", tags=["tailored-resumes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


# Allowed chars in the Content-Disposition filename. We intentionally drop
# spaces, em-dashes, and unicode — they trigger RFC 6266 encoding overhead
# and some browsers truncate at the first non-ASCII char. Slug must be
# downloadable as-is.
_SLUG_RE = re.compile(r"[^A-Za-z0-9\-]+")


def _safe_pdf_filename(name: Optional[str], resume_id: UUID) -> str:
    """Sanitise `name` into an ASCII-safe `*.pdf` filename.

    Rules:
      - Replace any run of disallowed chars with a single `-`.
      - Trim leading/trailing dashes.
      - Cap at 80 chars (well under the 255-byte filename limit).
      - If the result is empty, fall back to `resume-<8 chars of uuid>`.
    """
    raw = (name or "").strip()
    slug = _SLUG_RE.sub("-", raw).strip("-")
    if not slug:
        slug = f"resume-{str(resume_id)[:8]}"
    return f"{slug[:80]}.pdf"


def _build_placeholder_html(resume: TailoredResume) -> str:
    """Build a minimal placeholder HTML for the PDF.

    TODO(TAILOR-4): replace this with the real ClassicTemplate rendered via
    react-dom/server (or a Python equivalent). For now we render the user's
    name + a "PDF coming soon" banner so the endpoint contract — auth,
    ownership, content-type, filename, byte stream — is verifiable end-to-end
    today and frontend-dev / ui-designer can plug their template in later.

    The font CSS is loaded from `/static/fonts/...` via the FastAPI
    StaticFiles mount (see `app/main.py`). Because Playwright's
    `set_content()` uses `about:blank` as the base URL, we prefix font
    URLs with a localhost origin so they resolve against the running API.
    """
    font_family = resume.font_snapshot or DEFAULT_FONT
    personal = (resume.tailored_data or {}).get("personal_info") or {}
    full_name = personal.get("full_name") or "Your Name"

    # Playwright's set_content() base URL is about:blank — relative URLs
    # don't resolve. Use the loopback origin Chromium runs in; the FastAPI
    # app is on the same container at port 8000.
    base_url = "http://127.0.0.1:8000"

    font_face = get_font_face_css(font_family, base_url=base_url)
    font_stack = get_default_font_stack(font_family)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{full_name} — Resume</title>
<style>
{font_face}
* {{ box-sizing: border-box; }}
html, body {{
  margin: 0;
  padding: 0;
  font-family: {font_stack};
  color: #111;
  background: #fff;
}}
.wrapper {{
  padding: 24px;
}}
h1 {{
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
}}
.banner {{
  margin-top: 24px;
  padding: 16px;
  border: 1px dashed #999;
  border-radius: 6px;
  font-size: 14px;
  color: #555;
}}
</style>
</head>
<body>
<div class="wrapper">
  <h1>{full_name}</h1>
  <div class="banner">PDF rendering pipeline online — full resume template lands in TAILOR-4.</div>
</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def _serialize(row: TailoredResume) -> TailoredResumeResponse:
    """Build a TailoredResumeResponse with joined-Job + rating fields populated.

    `job_title` / `job_company` come from the eager-loaded `row.job` and
    `rating` from the eager-loaded `row.rating` (1:0..1) relationship — see
    `_load_owned` for the eager-loads. None of these are persisted on the
    tailored_resumes row. Defensive `getattr` so a missing relationship
    (e.g. orphan row) just yields `None` rather than raising.
    """
    job = getattr(row, "job", None)
    rating_row = getattr(row, "rating", None)
    response = TailoredResumeResponse.model_validate(row)
    if job is not None:
        response.job_title = job.title
        response.job_company = job.company
    if rating_row is not None:
        response.rating = rating_row.rating
    return response


def _load_owned(
    db: Session,
    tailored_resume_id: UUID,
    user: User,
) -> TailoredResume:
    """Load a TailoredResume with its Job eager-loaded, enforcing ownership.

    Raises 404 on both "not found" and "found but not owner" — same behaviour
    as the download endpoint, to avoid leaking existence.
    """
    row = (
        db.query(TailoredResume)
        .options(
            selectinload(TailoredResume.job),
            selectinload(TailoredResume.rating),
        )
        .filter(TailoredResume.id == tailored_resume_id)
        .first()
    )
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found.",
        )
    return row


@router.get(
    "/{tailored_resume_id}",
    response_model=TailoredResumeResponse,
)
def get_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> TailoredResumeResponse:
    """Fetch a single tailored resume by id (PRD 6.5).

    Auth: verified user. Ownership is checked at the row level; we 404 on
    both "not found" and "found but not owner" to avoid leaking existence.
    The joined Job is eager-loaded so the response can carry `job_title`
    and `job_company` for the editor subtitle without a second round-trip.
    """
    row = _load_owned(db, tailored_resume_id, current_user)
    return _serialize(row)


@router.patch(
    "/{tailored_resume_id}",
    response_model=TailoredResumeResponse,
)
def patch_tailored_resume(
    tailored_resume_id: UUID,
    data: TailoredResumePatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> TailoredResumeResponse:
    """Partial-update a tailored resume (PRD 6.5).

    Snapshot fields (`profile_snapshot`, `template_snapshot`, `match_score`,
    `matched_keywords`, `applied_changes`) are immutable per PRD 6.5 — they
    are not exposed on the request schema, so any client-supplied values
    are silently dropped by Pydantic before we get here.

    `tailored_data` is JSONB-loaded as a dict on the model side, so we
    `model_dump(mode="json")` the validated Pydantic value before assignment
    to keep the column round-trip-safe (mirrors the pattern in the tailor
    endpoint at `routers/jobs.py`).

    Reassigns each mutated field rather than mutating in place — SQLAlchemy
    does not track in-place edits to JSONB columns.
    """
    row = _load_owned(db, tailored_resume_id, current_user)

    # `exclude_unset=True`: only fields the client actually sent are applied.
    # A missing field on the wire is preserved; an explicitly-null field
    # passes through (and would currently fail at the DB NOT NULL boundary —
    # by design, the schema fields are typed Optional[T] with default None
    # purely so they're skippable, not nullable).
    payload = data.model_dump(exclude_unset=True, mode="json")

    if "name" in payload:
        row.name = payload["name"]
    if "tailored_data" in payload:
        row.tailored_data = payload["tailored_data"]
    if "sections_order_snapshot" in payload:
        row.sections_order_snapshot = payload["sections_order_snapshot"]
    if "font_snapshot" in payload:
        row.font_snapshot = payload["font_snapshot"]

    # `updated_at` is wired via `TimestampMixin.onupdate=func.now()`, which
    # only fires when SQLAlchemy detects a column change — re-assigning
    # JSONB columns above is exactly that signal.
    db.commit()
    db.refresh(row)

    return _serialize(row)


@router.delete(
    "/{tailored_resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> Response:
    """Hard-delete a tailored resume (TAILOR-14, PRD 6.5).

    No soft delete in MVP per spec — the row is removed immediately and
    the FK `ai_quality_ratings.tailored_resume_id` (declared
    `ondelete=CASCADE` in migration 012) cleans up any associated rating
    in the same transaction.

    Auth: verified user. `_load_owned` 404s on both "not found" and
    "found but not owner" — that 404 flows through unchanged so we never
    leak existence to a non-owner attempting to delete.

    Does NOT consume AI credits (deletion is free, per spec).
    """
    row = _load_owned(db, tailored_resume_id, current_user)
    db.delete(row)
    db.commit()
    logger.info(
        "Tailored resume deleted: tailored_resume_id=%s user_id=%s",
        tailored_resume_id,
        current_user.id,
    )
    # 204 must have an empty body; explicit Response avoids FastAPI
    # serialising `None` into a JSON `null`.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{tailored_resume_id}/rating",
    response_model=AIQualityRatingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tailored_resume_rating(
    tailored_resume_id: UUID,
    data: AIQualityRatingCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> AIQualityRatingResponse:
    """Submit a 1-5 star rating for a tailored resume (TAILOR-14, PRD 6.10).

    Write-once per resume: the UNIQUE on `ai_quality_ratings.tailored_resume_id`
    is the source of truth. We catch `IntegrityError` from that constraint
    and translate to 409, rather than pre-checking with a SELECT —
    avoids a TOCTOU race when two requests submit concurrently.

    Auth: verified user. Resource ownership is enforced via `_load_owned`
    so a user cannot rate someone else's resume (404 on non-ownership).

    Does NOT consume AI credits (rating is free, per spec).
    """
    # Ownership check first — 404 hides existence from non-owners.
    _load_owned(db, tailored_resume_id, current_user)

    rating = AIQualityRating(
        user_id=current_user.id,
        tailored_resume_id=tailored_resume_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(rating)
    try:
        db.commit()
    except IntegrityError:
        # UNIQUE on tailored_resume_id violated → rating already exists.
        # Roll back so the session is reusable for the response cycle.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A rating already exists for this tailored resume.",
        )
    db.refresh(rating)

    logger.info(
        "AI quality rating submitted: tailored_resume_id=%s user_id=%s rating=%d",
        tailored_resume_id,
        current_user.id,
        data.rating,
    )
    return AIQualityRatingResponse.model_validate(rating)


@router.post(
    "/{tailored_resume_id}/rating-modal-shown",
    response_model=TailoredResumeRatingModalShownResponse,
    status_code=status.HTTP_200_OK,
)
def mark_rating_modal_shown(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> TailoredResumeRatingModalShownResponse:
    """Stamp the rating modal "first shown" timestamp (TAILOR-14, PRD 6.10).

    Idempotent by design: the UPDATE filters on
    `rating_modal_shown_at IS NULL`, so a repeat call matches zero rows
    and is a true DB-level no-op (no Python-side branch). The response
    always returns the *current* value — set on first call, unchanged
    thereafter — which the frontend uses to confirm registration
    without a follow-up GET.

    Auth: verified user. Ownership enforced via `_load_owned` (404s leak
    nothing).
    """
    # Ownership check — 404 if not owner. Also gives us the current row.
    row = _load_owned(db, tailored_resume_id, current_user)

    # Conditional UPDATE: only sets the timestamp when it's currently NULL.
    # Using a server-side `func.now()` keeps the timestamp authoritative
    # across timezones / clock skew between app instances.
    # `synchronize_session=False`: we discard the loaded `row` immediately
    # after by re-querying — no need for SQLAlchemy to update in-memory state.
    db.query(TailoredResume).filter(
        TailoredResume.id == tailored_resume_id,
        TailoredResume.rating_modal_shown_at.is_(None),
    ).update(
        {"rating_modal_shown_at": func.now()},
        synchronize_session=False,
    )
    db.commit()

    # Re-read the row to return the current (set or pre-existing) value.
    db.refresh(row)
    return TailoredResumeRatingModalShownResponse(
        rating_modal_shown_at=row.rating_modal_shown_at,
    )


@router.post(
    "/{tailored_resume_id}/download",
    status_code=status.HTTP_200_OK,
)
async def download_tailored_resume(
    tailored_resume_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> StreamingResponse:
    """Render the tailored resume to PDF and stream it back.

    Auth: verified user. Ownership is checked by joining `user_id`; we 404
    on both "not found" and "found but not owner" to avoid leaking
    existence (mirrors `tailor_resume` in `routers/jobs.py`).

    Failure modes:
      - 404: row not found, or owned by another user.
      - 504: PDF render exceeded `pdf_render_timeout_seconds`.
      - 500: any other Chromium / Playwright error.

    Does NOT consume AI credits and does NOT write to `usage_log` —
    rendering an existing resume to PDF is free.
    """
    row = (
        db.query(TailoredResume)
        .filter(TailoredResume.id == tailored_resume_id)
        .first()
    )
    if row is None or row.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume not found.",
        )

    html = _build_placeholder_html(row)

    try:
        pdf_bytes = await pdf_service.render_pdf(html)
    except PDFRenderTimeout:
        # Distinct error code so the frontend can show a "try again" toast
        # rather than a generic "something broke".
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="PDF render timed out. Please try again.",
        )
    except PDFRenderError as exc:
        logger.error(
            "PDF render failed for tailored_resume %s user %s: %s",
            row.id,
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to render PDF. Please try again later.",
        )

    filename = _safe_pdf_filename(row.name, row.id)
    headers = {
        # Content-Disposition with `attachment` triggers a save-as dialog
        # in browsers rather than rendering inline.
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(pdf_bytes)),
        # Prevent intermediaries from caching a personalised PDF.
        "Cache-Control": "private, no-store",
    }
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )
