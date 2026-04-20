"""
Registry of DOCX builder functions, keyed by template_id.
Add new templates here as they are implemented in later phases.
"""
from __future__ import annotations

import logging
from typing import Callable

from app.services.resume_export.classic_docx import build_classic_docx
from app.services.resume_export.minimal_docx import build_minimal_docx
from app.services.resume_export.modern_docx import build_modern_docx
from app.services.resume_export.types import ResumeData

TEMPLATE_DOCX_BUILDERS: dict[str, Callable[[ResumeData], bytes]] = {
    "classic": build_classic_docx,
    "modern": build_modern_docx,
    "minimal": build_minimal_docx,
}

DEFAULT_TEMPLATE = "classic"


def get_docx_builder(template_id: str) -> Callable[[ResumeData], bytes]:
    """Return the DOCX builder for the given template, falling back to classic."""
    builder = TEMPLATE_DOCX_BUILDERS.get(template_id)
    if builder is None:
        logging.getLogger(__name__).warning(
            "Unknown template_id '%s', falling back to classic", template_id
        )
        builder = TEMPLATE_DOCX_BUILDERS[DEFAULT_TEMPLATE]
    return builder
