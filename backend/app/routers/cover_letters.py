from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.cover_letter import CoverLetter
from app.models.enums import CLLength, CLStyle, CLTone
from app.models.job import Job
from app.models.user import User
from app.schemas.cover_letter import (
    CoverLetterFinalizeRequest,
    CoverLetterListResponse,
    CoverLetterResponse,
    CoverLetterUpdateRequest,
)
from app.services import cover_letter_service
from app.services.cover_letter_service import get_cover_letter_or_404
from app.services.pdf_service import (
    PDFRenderError,
    PDFRenderTimeout,
    pdf_service,
)
from app.utils.cover_letter_export import (
    render_tiptap_to_docx,
    render_tiptap_to_html,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cover-letters", tags=["cover-letters"])


# ---------------------------------------------------------------------------
# Architectural notes (Phase 4 cover-letter rebuild):
# ---------------------------------------------------------------------------
# - The original POST /api/v1/cover-letters/generate (503 stub) has been
#   REMOVED. Generation now lives on the JOBS router as
#   POST /api/v1/jobs/{job_id}/cover-letter (CL-2) — see
#   `app/routers/jobs.py:generate_cover_letter_for_job`. This mirrors how
#   `POST /jobs/{job_id}/tailor` lives on the jobs router.
# - POST /api/v1/cover-letters (CL-3, this file) is the FINALIZE endpoint:
#   it persists the user's chosen variant from the wizard. Credit was
#   already consumed in CL-2 — this endpoint is idempotent finalisation.
# - POST /api/v1/cover-letters/{id}/regenerate is intentionally retained
#   as a 503 stub (see comment block on the route below).
# - POST /api/v1/cover-letters/{id}/download (PDF) and
#   POST /api/v1/cover-letters/{id}/download-docx (DOCX) — CL-9. Both
#   are FREE (no AI credit, no usage_log row). The legacy
#   /export 503 stub has been removed; CL-8's editor wires its
#   "Export PDF" / "Export DOCX" buttons to the new endpoints.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _wrap_plain_text_as_tiptap(text: str) -> dict:
    """Wrap a plain-text variant into a minimal Tiptap document JSON.

    Empty string yields an empty paragraph (the editor renders fine).
    Non-empty text is split on newlines: each line becomes a paragraph
    with a single text node so the editor's word/line count matches the
    variant the AI produced.
    """
    if text == "":
        return {
            "type": "doc",
            "content": [{"type": "paragraph"}],
        }

    lines = text.split("\n")
    return {
        "type": "doc",
        "content": [
            (
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": line}],
                }
                if line != ""
                else {"type": "paragraph"}
            )
            for line in lines
        ],
    }


# ---------------------------------------------------------------------------
# Finalize (CL-3)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=CoverLetterResponse,
    status_code=status.HTTP_201_CREATED,
)
def finalize_cover_letter(
    payload: CoverLetterFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterResponse:
    """Persist a finalised cover letter chosen from the wizard's variants
    (CL-3).

    Validation order (each check short-circuits on first failure):
      1. Job ownership — 404 if missing or not owned (no existence leak).
      2. No existing CoverLetter for (user, job) — 409 with structured
         `COVER_LETTER_ALREADY_EXISTS` body including the existing CL id
         (matches CL-2's response shape so the FE can route uniformly).
      3. UNIQUE(user_id, job_id) DB safety net — caught and re-emitted as 409.

    Behaviour:
      - If `content` is a string, it is wrapped server-side into a minimal
        Tiptap document JSON. If `content` is a dict, it is trusted as-is
        (the wizard sends Tiptap JSON for rich-text editing). MVP keeps the
        dict-shape check loose.
      - Inserts the row with all immutable fields (source_type,
        source_snapshot, style, tone, length, additional_context).
      - Does NOT consume credit — CL-2 already did when the AI ran.
      - Returns the inserted row via the existing CoverLetterResponse
        serializer.
    """
    # 1. Job ownership.
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if job is None or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # 2. No existing CoverLetter for (user, job).
    existing = (
        db.query(CoverLetter)
        .filter(
            CoverLetter.user_id == current_user.id,
            CoverLetter.job_id == job.id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "A cover letter already exists for this job.",
                "error_code": "COVER_LETTER_ALREADY_EXISTS",
                "existing_id": str(existing.id),
            },
        )

    # 3. Normalise content to Tiptap JSON.
    content_value = payload.content
    if isinstance(content_value, str):
        content_dict: dict = _wrap_plain_text_as_tiptap(content_value)
    else:
        # Trust the FE-supplied Tiptap JSON. MVP keeps shape check loose
        # per CL-3 spec — the editor will round-trip whatever we store.
        content_dict = dict(content_value)

    # 4. Map API fields → DB columns. Style/tone/length are stored as PG
    #    enums today (see app/models/cover_letter.py NOTE) so we coerce
    #    the wire-string into the matching enum value. The DB column for
    #    length is `length_setting` (legacy name; PRD 6.6 calls it `length`).
    row = CoverLetter(
        user_id=current_user.id,
        job_id=job.id,
        name=payload.name,
        content=content_dict,
        source_type=payload.source_type,
        source_snapshot=dict(payload.source_snapshot or {}),
        style=CLStyle(payload.style),
        tone=CLTone(payload.tone),
        length_setting=CLLength(payload.length),
        additional_context=payload.additional_context,
    )
    db.add(row)

    try:
        db.commit()
    except IntegrityError as exc:
        # Race: another request inserted a CL for this (user, job) between
        # our SELECT in step 2 and the INSERT here. The UNIQUE constraint
        # caught it; re-emit 409 with the now-existing id so the FE can
        # deep-link the same way as the non-race path.
        db.rollback()
        logger.info(
            "CL finalize: UNIQUE conflict for user %s job %s (race): %s",
            current_user.id,
            job.id,
            exc,
        )
        race_existing = (
            db.query(CoverLetter)
            .filter(
                CoverLetter.user_id == current_user.id,
                CoverLetter.job_id == job.id,
            )
            .first()
        )
        existing_id = str(race_existing.id) if race_existing else None
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "A cover letter already exists for this job.",
                "error_code": "COVER_LETTER_ALREADY_EXISTS",
                "existing_id": existing_id,
            },
        )

    db.refresh(row)
    logger.info(
        "Cover letter finalised: cl_id=%s user_id=%s job_id=%s source_type=%s",
        row.id,
        current_user.id,
        job.id,
        payload.source_type,
    )
    return row  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("/", response_model=CoverLetterListResponse)
def list_cover_letters(
    job_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterListResponse:
    """List all cover letters for the current user, with optional job_id filter."""
    items, total = cover_letter_service.list_cover_letters(
        current_user, db, job_id=job_id, limit=limit, offset=offset
    )
    return CoverLetterListResponse(items=items, total=total)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

@router.get("/{cover_letter_id}", response_model=CoverLetterResponse)
def get_cover_letter(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterResponse:
    """Get a single cover letter by ID."""
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)
    return cl  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.patch("/{cover_letter_id}", response_model=CoverLetterResponse)
def update_cover_letter(
    cover_letter_id: UUID,
    data: CoverLetterUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CoverLetterResponse:
    """Partially update a cover letter (content, name, style, tone, length, selected variant)."""
    cl = get_cover_letter_or_404(cover_letter_id, current_user, db)

    if data.content is not None:
        cl.content = data.content
    if data.name is not None:
        cl.name = data.name
    if data.style is not None:
        cl.style = data.style
    if data.tone is not None:
        cl.tone = data.tone
    if data.length_setting is not None:
        cl.length_setting = data.length_setting
    if data.selected_variant_index is not None:
        cl.selected_variant_index = data.selected_variant_index

    db.commit()
    db.refresh(cl)

    logger.info("Cover letter updated: cl_id=%s user_id=%s", cover_letter_id, current_user.id)
    return cl  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{cover_letter_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_cover_letter(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """Delete a cover letter and its exported file."""
    await cover_letter_service.delete_cover_letter(cover_letter_id, current_user, db)


# ---------------------------------------------------------------------------
# Regenerate (intentionally retained 503 stub — see comment)
# ---------------------------------------------------------------------------
# MVP excludes regenerate per PRD §20. Endpoint kept as a 503 placeholder;
# do NOT delete the route — the wizard FE has the regenerate-button code
# commented out and a future feature flip will re-enable both ends together.
# When that lands, this handler will mirror CL-2's flow but operate on an
# existing CoverLetter row (consume one CL credit, replace `content` after
# the user picks a fresh variant).

@router.post("/{cover_letter_id}/regenerate", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
async def regenerate_cover_letter(cover_letter_id: UUID) -> dict:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Cover letter regeneration is excluded from MVP per PRD §20. Coming soon.",
    )


# ---------------------------------------------------------------------------
# Export — CL-9 (PDF/DOCX download)
# ---------------------------------------------------------------------------
# Both endpoints stream binary file bytes back to the browser. They are
# FREE — no AI credit consumed and no `usage_log` row written. Ownership
# is checked by direct comparison against `cl.user_id`; both "row missing"
# and "row owned by someone else" return 404 to avoid leaking existence
# (matches the 404 semantics of the tailored-resume download endpoint).


# Allowed chars in the Content-Disposition filename. Mirrors the
# tailored-resume download route — drop spaces and unicode so the
# slug is safe to use as a literal filename without RFC 6266 encoding.
_FILENAME_SLUG_RE = re.compile(r"[^A-Za-z0-9\-_]+")
# Cap mirrors the tailored-resume side; well under the 255-byte FS limit.
_FILENAME_MAX_LEN = 80


def _safe_cl_filename_stem(name: Optional[str]) -> str:
    """Sanitise ``name`` into an ASCII-safe filename stem (no extension).

    Rules (per CL-9 spec):
      - lowercase
      - spaces → ``-``
      - drop every char that isn't ``[a-z0-9_-]``
      - collapse runs of ``-`` (artefact of the previous step) into one
      - trim leading / trailing ``-``
      - cap at 80 chars
      - if the result is empty, fall back to ``cover-letter``
    """
    raw = (name or "").strip().lower().replace(" ", "-")
    slug = _FILENAME_SLUG_RE.sub("", raw)
    slug = re.sub(r"-+", "-", slug).strip("-_")
    if not slug:
        slug = "cover-letter"
    return slug[:_FILENAME_MAX_LEN]


def _load_owned_cover_letter(
    db: Session, cover_letter_id: UUID, user: User
) -> CoverLetter:
    """Load a CoverLetter, 404 on missing-or-not-owner.

    Single 404 path on both branches keeps existence opaque to a
    non-owner probing the URL (mirrors the tailored-resume download
    pattern). The HTTP detail string is identical for both cases.
    """
    row = (
        db.query(CoverLetter)
        .filter(CoverLetter.id == cover_letter_id)
        .first()
    )
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cover letter not found.",
        )
    return row


@router.post(
    "/{cover_letter_id}/download",
    status_code=status.HTTP_200_OK,
)
async def download_cover_letter_pdf(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> StreamingResponse:
    """Render the cover letter to PDF and stream it back.

    Pipeline mirrors the tailored-resume download route:
      Tiptap JSON → letter-styled HTML → Playwright/Chromium → PDF bytes.

    Failure modes:
      - 404: row not found, or owned by another user.
      - 504: PDF render exceeded ``pdf_render_timeout_seconds``.
      - 500: any other Chromium / Playwright error.

    Does NOT consume AI credits and does NOT write to ``usage_log`` —
    rendering an existing cover letter to PDF is free.
    """
    cl = _load_owned_cover_letter(db, cover_letter_id, current_user)

    # ``content`` is JSONB-loaded as a dict on the model side. Defensive
    # ``or {}`` because legacy rows pre-migration-011 could in theory
    # carry an empty value — the renderer copes with an empty doc.
    html = render_tiptap_to_html(cl.content or {}, title=cl.name or "Cover Letter")

    try:
        pdf_bytes = await pdf_service.render_pdf(html)
    except PDFRenderTimeout:
        # Distinct error code so the frontend can show a "try again"
        # toast rather than a generic "something broke".
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="PDF render timed out. Please try again.",
        )
    except PDFRenderError as exc:
        logger.error(
            "PDF render failed for cover_letter %s user %s: %s",
            cl.id,
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to render PDF. Please try again later.",
        )

    filename = f"{_safe_cl_filename_stem(cl.name)}.pdf"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(pdf_bytes)),
        # Personalised content — stop intermediaries from caching it.
        "Cache-Control": "private, no-store",
    }
    logger.info(
        "Cover letter PDF rendered: cl_id=%s user_id=%s bytes=%d",
        cl.id,
        current_user.id,
        len(pdf_bytes),
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )


@router.post(
    "/{cover_letter_id}/download-docx",
    status_code=status.HTTP_200_OK,
)
def download_cover_letter_docx(
    cover_letter_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> StreamingResponse:
    """Render the cover letter to DOCX and stream it back.

    DOCX generation is purely CPU-bound (no Chromium hop) and finishes
    well under the 5s target for a typical letter, so this stays a
    sync handler — no event-loop yield is gained from making it async.

    Failure modes:
      - 404: row not found, or owned by another user.
      - 500: ``python-docx`` raised while serialising the document.

    Does NOT consume AI credits and does NOT write to ``usage_log``.
    """
    cl = _load_owned_cover_letter(db, cover_letter_id, current_user)

    try:
        docx_bytes = render_tiptap_to_docx(cl.content or {}, title=cl.name)
    except Exception as exc:  # noqa: BLE001 — surfaced as 500 for the FE
        logger.error(
            "DOCX render failed for cover_letter %s user %s: %s",
            cl.id,
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to render DOCX. Please try again later.",
        )

    filename = f"{_safe_cl_filename_stem(cl.name)}.docx"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(docx_bytes)),
        "Cache-Control": "private, no-store",
    }
    logger.info(
        "Cover letter DOCX rendered: cl_id=%s user_id=%s bytes=%d",
        cl.id,
        current_user.id,
        len(docx_bytes),
    )
    return StreamingResponse(
        BytesIO(docx_bytes),
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        headers=headers,
    )
