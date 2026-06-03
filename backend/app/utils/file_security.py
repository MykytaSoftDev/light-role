"""Content-based file security checks for document uploads (TASK 15 & 16).

This module centralises the *authoritative* validation that document uploads
are what they claim to be, independent of attacker-controlled signals like the
filename extension or the declared ``Content-Type`` header.

Two concerns live here:

* **Magic-byte sniffing (TASK 15)** — confirm the raw bytes actually begin with
  the file-type signature (``%PDF-`` for PDF, the ZIP local-file-header for
  DOCX) and, for DOCX, that the ZIP is a real OOXML Word document.
* **Decompression-bomb guard (TASK 16)** — bound the uncompressed size and
  compression ratio of a DOCX (ZIP) archive so a small crafted file cannot
  expand into gigabytes of memory during parsing.

Callers should treat :class:`FileSecurityError` as a 422 ("bad input file")
condition — it never indicates a server fault.
"""
from __future__ import annotations

import io
import logging
import zipfile

logger = logging.getLogger(__name__)


class FileSecurityError(ValueError):
    """Raised when an uploaded file fails a content-based security check.

    Subclasses :class:`ValueError` so existing handlers that already map
    ``ValueError`` to HTTP 422 (e.g. the AI parse path) keep working without
    change.
    """


# --- Magic-byte signatures (TASK 15) ---------------------------------------

# Every PDF begins with this 5-byte signature.
_PDF_MAGIC = b"%PDF-"

# Every ZIP (and therefore every DOCX/OOXML) local file header starts with
# "PK\x03\x04". Empty/spanned archives use other PK signatures, but a real
# document upload always carries at least one local file header first.
_ZIP_LOCAL_FILE_HEADER = b"PK\x03\x04"

# A valid OOXML package always contains the content-types map at its root, and
# a Word document specifically carries the main document part. We require both
# to reject non-Word OOXML (e.g. .xlsx/.pptx renamed to .docx) and bare zips.
_OOXML_CONTENT_TYPES_ENTRY = "[Content_Types].xml"
_DOCX_DOCUMENT_ENTRY = "word/document.xml"


# --- Decompression-bomb caps (TASK 16) -------------------------------------

# Max total UNCOMPRESSED size we are willing to expand a DOCX archive to.
# Defense-in-depth multiple of the on-disk upload cap: a legitimate 10 MB DOCX
# decompresses to well under this, while a zip-bomb (tiny on disk, enormous
# uncompressed) trips it. 20x the 10 MB upload cap = 200 MB.
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # mirror of the upload cap (10 MB)
DOCX_MAX_UNCOMPRESSED_BYTES = 20 * MAX_FILE_SIZE_BYTES  # 200 MB

# Max overall compression ratio (uncompressed / compressed). Office documents
# (mostly XML) compress maybe 5-10x; 200x is comfortably above any legitimate
# document yet well below the ratios crafted bombs rely on.
DOCX_MAX_COMPRESSION_RATIO = 200

# Cap on the number of members in the ZIP central directory. Real DOCX files
# have on the order of dozens of parts; tens of thousands of entries is a
# resource-exhaustion signal.
DOCX_MAX_ENTRIES = 5000


def verify_pdf_magic(file_bytes: bytes) -> None:
    """Confirm bytes begin with the PDF signature, else raise.

    Raises:
        FileSecurityError: when the leading bytes are not ``%PDF-``.
    """
    if not file_bytes.startswith(_PDF_MAGIC):
        raise FileSecurityError(
            "File does not appear to be a valid PDF (bad signature)."
        )


def verify_docx_magic_and_safety(file_bytes: bytes) -> None:
    """Confirm bytes are a real, bounded DOCX (OOXML Word) archive.

    Performs the TASK 15 magic-byte / OOXML-structure check AND the TASK 16
    decompression-bomb guard in one pass over the central directory (cheap —
    no member is decompressed).

    Raises:
        FileSecurityError: when the bytes are not a ZIP, not a Word OOXML
            package, or exceed the configured bomb thresholds.
    """
    # TASK 15: ZIP local file header must lead the stream.
    if not file_bytes.startswith(_ZIP_LOCAL_FILE_HEADER):
        raise FileSecurityError(
            "File does not appear to be a valid DOCX (not a ZIP archive)."
        )

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            infos = zf.infolist()

            # TASK 16: bound the member count before iterating further.
            if len(infos) > DOCX_MAX_ENTRIES:
                raise FileSecurityError(
                    "DOCX archive contains too many entries."
                )

            names = {info.filename for info in infos}

            # TASK 15: must be an OOXML package AND specifically a Word doc.
            if _OOXML_CONTENT_TYPES_ENTRY not in names:
                raise FileSecurityError(
                    "File is not a valid OOXML package "
                    f"(missing {_OOXML_CONTENT_TYPES_ENTRY})."
                )
            if _DOCX_DOCUMENT_ENTRY not in names:
                raise FileSecurityError(
                    "File is not a Word document "
                    f"(missing {_DOCX_DOCUMENT_ENTRY})."
                )

            # TASK 16: bound the declared uncompressed size and ratio using the
            # central-directory metadata only (no decompression performed here).
            total_uncompressed = 0
            total_compressed = 0
            for info in infos:
                total_uncompressed += info.file_size
                total_compressed += info.compress_size
                if total_uncompressed > DOCX_MAX_UNCOMPRESSED_BYTES:
                    raise FileSecurityError(
                        "DOCX uncompressed size exceeds the safety limit."
                    )

            # Guard the ratio only once there is enough compressed data to make
            # the ratio meaningful (avoid divide-by-zero / tiny-file noise).
            if total_compressed > 0:
                ratio = total_uncompressed / total_compressed
                if ratio > DOCX_MAX_COMPRESSION_RATIO:
                    raise FileSecurityError(
                        "DOCX compression ratio exceeds the safety limit."
                    )
    except zipfile.BadZipFile as exc:
        raise FileSecurityError(
            "File does not appear to be a valid DOCX (corrupt ZIP)."
        ) from exc


def verify_document_magic(file_bytes: bytes, file_format: str) -> None:
    """Dispatch magic-byte / safety verification by declared format.

    ``file_format`` is the *declared* format hint (from extension/content-type)
    — the byte-level checks performed here are authoritative and will reject a
    mismatch (e.g. a ``.pdf``-named text file, or a ``.docx`` that is not a zip).

    Raises:
        FileSecurityError: on any signature mismatch or bomb-threshold breach.
    """
    fmt = (file_format or "").lower().lstrip(".")
    if fmt == "pdf":
        verify_pdf_magic(file_bytes)
    elif fmt == "docx":
        verify_docx_magic_and_safety(file_bytes)
    else:
        raise FileSecurityError(f"Unsupported file format: {file_format!r}")
