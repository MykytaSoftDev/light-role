from __future__ import annotations

import hashlib
import io
import logging
import re

from app.utils.file_security import (
    FileSecurityError,
    verify_docx_magic_and_safety,
    verify_pdf_magic,
)

logger = logging.getLogger(__name__)


def compute_content_hash(text: str) -> str:
    """Normalize text and compute SHA-256 hash for duplicate detection."""
    normalized = re.sub(r'\s+', ' ', text.lower().strip())
    normalized = re.sub(r'[^\w\s]', '', normalized)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


async def extract_text_from_file(file_contents: bytes, ext: str) -> str:
    """
    Extract plain text from a PDF or DOCX file.

    Args:
        file_contents: Raw bytes of the uploaded file.
        ext: File extension without leading dot — "pdf" or "docx".

    Returns:
        Extracted text as a single string. Returns an empty string if extraction
        fails rather than raising, so callers can decide how to handle the empty case.
    """
    if ext == "pdf":
        return _extract_from_pdf(file_contents)
    if ext == "docx":
        return _extract_from_docx(file_contents)

    logger.warning("extract_text_from_file called with unsupported extension: %s", ext)
    return ""


def _extract_from_pdf(file_contents: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    try:
        # TASK 15: reject anything that is not a real PDF before parsing.
        verify_pdf_magic(file_contents)

        import pdfplumber  # type: ignore[import-untyped]

        pages: list[str] = []
        with pdfplumber.open(io.BytesIO(file_contents)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)

        result = "\n".join(pages)
        logger.debug("PDF extraction complete: %d pages, %d chars", len(pages), len(result))
        return result
    except Exception as exc:
        logger.warning("PDF text extraction failed: %s", exc)
        return ""


def _extract_from_docx(file_contents: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        # TASK 15/16: confirm real OOXML Word zip and guard against zip bombs
        # before handing the bytes to python-docx.
        verify_docx_magic_and_safety(file_contents)

        from docx import Document  # type: ignore[import-untyped]

        doc = Document(io.BytesIO(file_contents))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)
        logger.debug("DOCX extraction complete: %d paragraphs, %d chars", len(paragraphs), len(result))
        return result
    except Exception as exc:
        logger.warning("DOCX text extraction failed: %s", exc)
        return ""
