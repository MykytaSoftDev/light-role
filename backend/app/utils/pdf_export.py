"""
PDF export utility for resumes.

Takes a parsed_data dict (the ResumeData structure stored in the DB) and
returns a well-formatted PDF as bytes using fpdf2.
"""
from __future__ import annotations

import logging
from typing import Any

from fpdf import FPDF  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Unicode → Latin-1 sanitizer
# ---------------------------------------------------------------------------
_UNICODE_MAP = str.maketrans({
    "\u2014": "-",   # em dash  —
    "\u2013": "-",   # en dash  –
    "\u2012": "-",   # figure dash
    "\u2010": "-",   # hyphen
    "\u2011": "-",   # non-breaking hyphen
    "\u2018": "'",   # left single quotation mark  '
    "\u2019": "'",   # right single quotation mark '
    "\u201a": ",",   # single low quotation mark   ‚
    "\u201c": '"',   # left double quotation mark  "
    "\u201d": '"',   # right double quotation mark "
    "\u2022": "*",   # bullet •
    "\u2023": "*",   # triangular bullet ‣
    "\u2043": "-",   # hyphen bullet ⁃
    "\u2026": "...", # horizontal ellipsis …
    "\u00a0": " ",   # non-breaking space
    "\u00b7": "*",   # middle dot ·
    "\u2192": "->",  # right arrow →
    "\u2190": "<-",  # left arrow ←
    "\u00e9": "e",   # é
    "\u00e8": "e",   # è
    "\u00ea": "e",   # ê
    "\u00eb": "e",   # ë
    "\u00e0": "a",   # à
    "\u00e1": "a",   # á
    "\u00e2": "a",   # â
    "\u00e4": "a",   # ä
    "\u00fc": "u",   # ü
    "\u00fa": "u",   # ú
    "\u00f6": "o",   # ö
    "\u00f3": "o",   # ó
    "\u00f1": "n",   # ñ
    "\u00df": "ss",  # ß
})


def _s(text: Any) -> str:
    """Convert value to string and sanitize non-Latin-1 characters."""
    if text is None:
        return ""
    result = str(text).translate(_UNICODE_MAP)
    # Final safety net: drop any remaining non-Latin-1 characters
    return result.encode("latin-1", errors="replace").decode("latin-1")


# ---------------------------------------------------------------------------
# Layout constants
# ---------------------------------------------------------------------------
_MARGIN = 20          # mm — left / right / top / bottom
_PAGE_W = 210         # A4 width in mm
_CONTENT_W = _PAGE_W - _MARGIN * 2

_NAME_SIZE = 20
_CONTACT_SIZE = 10
_HEADING_SIZE = 11
_BODY_SIZE = 10
_SMALL_SIZE = 9

_DARK = (51, 51, 51)       # #333333
_MID = (85, 85, 85)        # #555555
_BLACK = (0, 0, 0)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_pdf(parsed_data: dict[str, Any]) -> bytes:
    """
    Convert a parsed_data dict into an A4 PDF and return it as bytes.

    Sections rendered: personal_info, summary, experience, education,
    skills, languages, certifications.
    """
    pdf = _ResumePDF()
    pdf.add_page()

    personal_info: dict[str, Any] = parsed_data.get("personal_info") or {}
    _render_personal_info(pdf, personal_info)

    summary: str | None = parsed_data.get("summary")
    if summary and summary.strip():
        _render_section_heading(pdf, "Summary")
        _body(pdf, _s(summary.strip()))

    experience: list[dict] = parsed_data.get("experience") or []
    if experience:
        _render_section_heading(pdf, "Experience")
        for item in experience:
            _render_experience_item(pdf, item)

    education: list[dict] = parsed_data.get("education") or []
    if education:
        _render_section_heading(pdf, "Education")
        for item in education:
            _render_education_item(pdf, item)

    skills: list[str] = parsed_data.get("skills") or []
    if skills:
        _render_section_heading(pdf, "Skills")
        _body(pdf, _s(", ".join(s for s in skills if s)))

    languages: list[str] = parsed_data.get("languages") or []
    if languages:
        _render_section_heading(pdf, "Languages")
        _body(pdf, _s(", ".join(lang for lang in languages if lang)))

    certifications: list[dict] = parsed_data.get("certifications") or []
    if certifications:
        _render_section_heading(pdf, "Certifications")
        for cert in certifications:
            _render_certification_item(pdf, cert)

    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# FPDF subclass
# ---------------------------------------------------------------------------

class _ResumePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4")
        self.set_margins(_MARGIN, _MARGIN, _MARGIN)
        self.set_auto_page_break(auto=True, margin=_MARGIN)


# ---------------------------------------------------------------------------
# Section renderers
# ---------------------------------------------------------------------------

def _render_personal_info(pdf: _ResumePDF, info: dict[str, Any]) -> None:
    name: str = (info.get("name") or "").strip()
    if name:
        pdf.set_font("Helvetica", style="B", size=_NAME_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.cell(w=_CONTENT_W, h=10, text=_s(name), align="C", new_x="LMARGIN", new_y="NEXT")

    contact_parts: list[str] = []
    for field in ("email", "phone", "location", "linkedin", "website"):
        value = (info.get(field) or "").strip()
        if value:
            contact_parts.append(value)

    if contact_parts:
        pdf.set_font("Helvetica", size=_CONTACT_SIZE)
        pdf.set_text_color(*_MID)
        pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(" | ".join(contact_parts)), align="C")

    pdf.ln(4)


def _render_section_heading(pdf: _ResumePDF, heading: str) -> None:
    pdf.ln(3)
    pdf.set_font("Helvetica", style="B", size=_HEADING_SIZE)
    pdf.set_text_color(*_DARK)
    pdf.cell(w=_CONTENT_W, h=7, text=heading.upper(), new_x="LMARGIN", new_y="NEXT")
    # Thin horizontal rule
    x = pdf.get_x()
    y = pdf.get_y()
    pdf.set_draw_color(170, 170, 170)
    pdf.line(x, y, x + _CONTENT_W, y)
    pdf.ln(2)


def _render_experience_item(pdf: _ResumePDF, item: dict[str, Any]) -> None:
    title: str = (item.get("title") or "").strip()
    company: str = (item.get("company") or "").strip()
    start_date: str = (item.get("start_date") or "").strip()
    end_date: str = ("Present" if item.get("current") else (item.get("end_date") or "")).strip()
    description: str = (item.get("description") or "").strip()
    achievements: list[str] = item.get("achievements") or []

    heading_parts = [p for p in (title, company) if p]
    heading_text = " - ".join(heading_parts) if heading_parts else "Untitled Position"

    date_parts = [p for p in (start_date, end_date) if p]
    date_text = _s(" - ".join(date_parts)) if date_parts else ""

    if date_text:
        pdf.set_font("Helvetica", style="I", size=_SMALL_SIZE)
        date_w = pdf.get_string_width(date_text) + 2
        title_w = _CONTENT_W - date_w

        pdf.set_font("Helvetica", style="B", size=_BODY_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.cell(w=title_w, h=6, text=_s(heading_text))

        pdf.set_font("Helvetica", style="I", size=_SMALL_SIZE)
        pdf.set_text_color(*_MID)
        pdf.cell(w=date_w, h=6, text=date_text, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*_BLACK)
    else:
        pdf.set_font("Helvetica", style="B", size=_BODY_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(heading_text))

    if description:
        _body(pdf, _s(description))

    for achievement in achievements:
        if achievement and achievement.strip():
            pdf.set_font("Helvetica", size=_BODY_SIZE)
            pdf.set_text_color(*_BLACK)
            pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(f"*  {achievement.strip()}"))

    pdf.ln(2)


def _render_education_item(pdf: _ResumePDF, item: dict[str, Any]) -> None:
    institution: str = (item.get("institution") or "").strip()
    degree: str = (item.get("degree") or "").strip()
    field: str = (item.get("field") or "").strip()
    start_date: str = (item.get("start_date") or "").strip()
    end_date: str = (item.get("end_date") or "").strip()
    gpa: str = (item.get("gpa") or "").strip()

    degree_parts = [p for p in (degree, field) if p]
    degree_text = ", ".join(degree_parts) if degree_parts else ""
    heading_parts = [p for p in (institution, degree_text) if p]
    heading_text = " - ".join(heading_parts) if heading_parts else "Untitled"

    meta_parts: list[str] = []
    date_parts = [p for p in (start_date, end_date) if p]
    if date_parts:
        meta_parts.append(" - ".join(date_parts))
    if gpa:
        meta_parts.append(f"GPA: {gpa}")
    meta_text = _s(" | ".join(meta_parts)) if meta_parts else ""

    if meta_text:
        pdf.set_font("Helvetica", style="I", size=_SMALL_SIZE)
        meta_w = pdf.get_string_width(meta_text) + 2
        inst_w = _CONTENT_W - meta_w

        pdf.set_font("Helvetica", style="B", size=_BODY_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.cell(w=inst_w, h=6, text=_s(heading_text))

        pdf.set_font("Helvetica", style="I", size=_SMALL_SIZE)
        pdf.set_text_color(*_MID)
        pdf.cell(w=meta_w, h=6, text=meta_text, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*_BLACK)
    else:
        pdf.set_font("Helvetica", style="B", size=_BODY_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(heading_text))

    pdf.ln(2)


def _render_certification_item(pdf: _ResumePDF, item: dict[str, Any]) -> None:
    name: str = (item.get("name") or "").strip()
    issuer: str = (item.get("issuer") or "").strip()
    date: str = (item.get("date") or "").strip()
    parts = [p for p in (name, issuer, date) if p]
    if parts:
        pdf.set_font("Helvetica", size=_BODY_SIZE)
        pdf.set_text_color(*_BLACK)
        pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(f"*  {' | '.join(parts)}"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _body(pdf: _ResumePDF, text: str) -> None:
    pdf.set_font("Helvetica", size=_BODY_SIZE)
    pdf.set_text_color(*_BLACK)
    pdf.multi_cell(w=_CONTENT_W, h=6, text=_s(text))
