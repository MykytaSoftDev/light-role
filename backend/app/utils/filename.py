"""Filename slug sanitisation for download endpoints.

Unifies the two historical slugifiers that fed the ``Content-Disposition``
header on the tailored-resume PDF download and the cover-letter PDF/DOCX
downloads. The two differ in case-handling, the allowed character set, and
their empty-result fallback, so behaviour is selected via the ``kind`` arg.
Each variant reproduces its original output byte-for-byte.

Allowed-char rationale (shared): drop spaces, em-dashes, and unicode so the
slug is safe to drop straight into a quoted filename without RFC 6266
encoding overhead — some browsers truncate at the first non-ASCII char.
"""

from __future__ import annotations

import re
from typing import Optional

# Cap well under the 255-byte filesystem filename limit. Shared by both kinds.
_FILENAME_MAX_LEN = 80

# --- "resume" kind --------------------------------------------------------
# Replace any run of disallowed chars with a single "-". Case-preserving and
# underscore is NOT allowed (an underscore is a disallowed char here, so it
# collapses to "-").
_RESUME_SLUG_RE = re.compile(r"[^A-Za-z0-9\-]+")

# --- "cover_letter" kind --------------------------------------------------
# Applied AFTER lowercasing + space→"-". Underscore IS allowed and survives.
_CL_SLUG_RE = re.compile(r"[^a-z0-9_-]+")


def safe_filename_stem(name: Optional[str], *, kind: str) -> str:
    """Sanitise ``name`` into an ASCII-safe filename stem (no extension).

    ``kind="resume"`` (mirrors the old ``_safe_pdf_filename`` stem logic):
      - replace any run of ``[^A-Za-z0-9\\-]`` with a single ``-``
      - trim leading/trailing ``-``
      - cap at 80 chars
      - case is preserved; may return an EMPTY string — the caller is
        responsible for the ``resume-<uuid[:8]>`` fallback (it needs the id)
        and for appending ``.pdf``.

    ``kind="cover_letter"`` (mirrors the old ``_safe_cl_filename_stem``):
      - lowercase, spaces → ``-``
      - drop every char that isn't ``[a-z0-9_-]``
      - collapse runs of ``-`` into one
      - trim leading/trailing ``-`` and ``_``
      - empty result → ``cover-letter``
      - cap at 80 chars; caller appends the extension.
    """
    if kind == "resume":
        raw = (name or "").strip()
        slug = _RESUME_SLUG_RE.sub("-", raw).strip("-")
        return slug[:_FILENAME_MAX_LEN]

    if kind == "cover_letter":
        raw = (name or "").strip().lower().replace(" ", "-")
        slug = _CL_SLUG_RE.sub("", raw)
        slug = re.sub(r"-+", "-", slug).strip("-_")
        if not slug:
            slug = "cover-letter"
        return slug[:_FILENAME_MAX_LEN]

    raise ValueError(f"Unknown filename kind: {kind!r}")
