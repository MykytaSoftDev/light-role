"""Shared download-response builder.

Consolidates the ``StreamingResponse`` construction used by the binary
download endpoints (tailored-resume PDF, cover-letter PDF, cover-letter
DOCX). Only the final response object is shared — each endpoint keeps its own
render call and its own distinct error handling (e.g. PDFRenderTimeout → 504,
other render errors → 500) upstream of this helper.
"""

from __future__ import annotations

from io import BytesIO

from fastapi.responses import StreamingResponse


def build_download_response(
    data: bytes,
    filename: str,
    media_type: str = "application/pdf",
) -> StreamingResponse:
    """Stream ``data`` back as a forced-download attachment.

    Headers (identical to the legacy inline construction):
      - ``Content-Disposition``: ``attachment; filename="<filename>"`` — the
        ``attachment`` disposition triggers a save-as dialog rather than
        inline rendering.
      - ``Content-Length``: ``str(len(data))``.
      - ``Cache-Control``: ``private, no-store`` — personalised content;
        stop intermediaries from caching it.

    ``filename`` is expected to already include its extension
    (``.pdf`` / ``.docx``).
    """
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(data)),
        "Cache-Control": "private, no-store",
    }
    return StreamingResponse(
        BytesIO(data),
        media_type=media_type,
        headers=headers,
    )
