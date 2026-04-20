"""
Phase 6 RT-6.1: Verify all DOCX builders produce valid output for all fixture inputs.
Run: pytest backend/tests/test_docx_all_templates.py -v
"""
import json
from pathlib import Path

import pytest

from app.services.resume_export.classic_docx import build_classic_docx
from app.services.resume_export.minimal_docx import build_minimal_docx
from app.services.resume_export.modern_docx import build_modern_docx
from app.services.resume_export.types import ResumeData

FIXTURES_DIR = Path(__file__).parent.parent.parent / "frontend" / "tests" / "fixtures"

BUILDERS = [
    ("classic", build_classic_docx),
    ("modern", build_modern_docx),
    ("minimal", build_minimal_docx),
]

FIXTURE_FILES = [
    "resume-data-minimal.json",
    "resume-data-full.json",
    "resume-data-edge.json",
]


def load_fixture(filename: str) -> ResumeData:
    path = FIXTURES_DIR / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    return ResumeData.model_validate(data)


@pytest.mark.parametrize("fixture_file", FIXTURE_FILES)
@pytest.mark.parametrize("template_id,builder", BUILDERS)
def test_docx_renders_without_error(
    template_id: str, fixture_file: str, builder
) -> None:
    """Each template builder must produce non-empty bytes for every fixture."""
    data = load_fixture(fixture_file)
    result = builder(data)
    assert isinstance(result, bytes), (
        f"{template_id}/{fixture_file}: expected bytes, got {type(result)}"
    )
    assert len(result) > 1000, (
        f"{template_id}/{fixture_file}: output too small ({len(result)} bytes)"
    )
    # Verify it starts with the DOCX magic bytes (PK zip header)
    assert result[:2] == b"PK", (
        f"{template_id}/{fixture_file}: not a valid ZIP/DOCX (got {result[:4]!r})"
    )


@pytest.mark.parametrize("template_id,builder", BUILDERS)
def test_docx_empty_optional_sections(template_id: str, builder) -> None:
    """Templates must not crash when all optional sections are empty."""
    data = ResumeData.model_validate(
        {
            "personal_info": {
                "name": "Test User",
                "email": None,
                "phone": None,
                "location": None,
                "linkedin": None,
                "website": None,
                "summary": None,
            },
            "summary": None,
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "certifications": [],
        }
    )
    result = builder(data)
    assert isinstance(result, bytes), (
        f"{template_id}/empty-sections: expected bytes, got {type(result)}"
    )
    assert result[:2] == b"PK", (
        f"{template_id}/empty-sections: not a valid ZIP/DOCX (got {result[:4]!r})"
    )
