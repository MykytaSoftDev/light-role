"""
Minimal resume template — DOCX builder.
Single-column, whitespace-heavy, no colored elements.
"""
from __future__ import annotations

import io

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from lxml import etree

from app.services.resume_export.types import ResumeData


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_minimal_docx(data: ResumeData) -> bytes:
    """
    Render a ResumeData instance as a minimal-style DOCX and return bytes.

    Single-column layout with generous whitespace and typographic hierarchy.
    Sections rendered: personal_info, summary, experience, education,
    skills, languages, certifications.
    """
    doc = Document()
    _configure_margins(doc)

    info = data.personal_info

    # Name — large, left-aligned
    name_para = doc.add_paragraph()
    run = name_para.add_run((info.name or "").strip())
    run.bold = True
    run.font.size = Pt(24)

    # Contact on one line with · separators
    contact_parts = [
        v for v in (info.email, info.phone, info.location, info.linkedin, info.website)
        if v and v.strip()
    ]
    if contact_parts:
        cp = doc.add_paragraph(" \u00b7 ".join(contact_parts))
        for run in cp.runs:
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    # Thin divider
    sep = doc.add_paragraph()
    _add_paragraph_bottom_border(sep)

    # Summary
    summary = data.summary
    if summary and summary.strip():
        _add_section_heading(doc, "Summary")
        p = doc.add_paragraph(summary.strip())
        for run in p.runs:
            run.font.size = Pt(10)

    # Experience
    if data.experience:
        _add_section_heading(doc, "Experience")
        for item in data.experience:
            _render_experience(doc, item)

    # Education
    if data.education:
        _add_section_heading(doc, "Education")
        for item in data.education:
            _render_education(doc, item)

    # Skills
    if data.skills:
        _add_section_heading(doc, "Skills")
        p = doc.add_paragraph(", ".join(s for s in data.skills if s))
        for run in p.runs:
            run.font.size = Pt(10)

    # Languages
    if data.languages:
        _add_section_heading(doc, "Languages")
        p = doc.add_paragraph(", ".join(lang for lang in data.languages if lang))
        for run in p.runs:
            run.font.size = Pt(10)

    # Certifications
    if data.certifications:
        _add_section_heading(doc, "Certifications")
        for cert in data.certifications:
            parts = [v for v in (cert.name, cert.issuer, cert.date) if v and v.strip()]
            if parts:
                p = doc.add_paragraph(" \u00b7 ".join(parts))
                for run in p.runs:
                    run.font.size = Pt(10)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Section renderers
# ---------------------------------------------------------------------------

def _add_section_heading(doc: Document, text: str) -> None:
    # Spacer above heading
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(12)

    p = doc.add_paragraph()
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0x11, 0x18, 0x27)  # #111827 near-black


def _render_experience(doc: Document, item) -> None:
    title = item.title.strip()
    company = item.company.strip()
    start_date = (item.start_date or "").strip()
    end_date = ("Present" if item.current else (item.end_date or "")).strip()

    # Title line
    p = doc.add_paragraph()
    run = p.add_run(title)
    run.bold = True
    run.font.size = Pt(11)

    # Company + date range on one line with · separator
    meta_parts: list[str] = []
    if company:
        meta_parts.append(company)
    date_parts = [v for v in (start_date, end_date) if v]
    if date_parts:
        meta_parts.append(" \u2013 ".join(date_parts))
    if meta_parts:
        mp = doc.add_paragraph(" \u00b7 ".join(meta_parts))
        for run in mp.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    if item.description.strip():
        dp = doc.add_paragraph(item.description.strip())
        for run in dp.runs:
            run.font.size = Pt(10)

    for ach in item.achievements:
        if ach and ach.strip():
            ap = doc.add_paragraph()
            run = ap.add_run(f"\u2014  {ach.strip()}")  # em-dash bullet
            run.font.size = Pt(10)


def _render_education(doc: Document, item) -> None:
    institution = item.institution.strip()
    degree_parts = [v for v in (item.degree, item.field or "") if v.strip()]
    degree_text = ", ".join(degree_parts)

    p = doc.add_paragraph()
    run = p.add_run(institution)
    run.bold = True
    run.font.size = Pt(11)

    if degree_text:
        dp = doc.add_paragraph(degree_text)
        for run in dp.runs:
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    date_parts = [v for v in (item.start_date or "", item.end_date or "") if v.strip()]
    meta_parts: list[str] = []
    if date_parts:
        meta_parts.append(" \u2013 ".join(date_parts))
    if item.gpa:
        meta_parts.append(f"GPA: {item.gpa}")
    if meta_parts:
        mp = doc.add_paragraph(" \u00b7 ".join(meta_parts))
        for run in mp.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)


# ---------------------------------------------------------------------------
# Document helpers
# ---------------------------------------------------------------------------

def _configure_margins(doc: Document) -> None:
    """Set 1.2-inch margins on all sides for generous whitespace."""
    section = doc.sections[0]
    section.top_margin = Inches(1.2)
    section.bottom_margin = Inches(1.2)
    section.left_margin = Inches(1.2)
    section.right_margin = Inches(1.2)


def _add_paragraph_bottom_border(para, hex_color: str = "E5E7EB") -> None:
    """Add a thin bottom border to a paragraph via raw OOXML manipulation."""
    pPr = para._p.get_or_add_pPr()
    pBdr = etree.SubElement(pPr, qn("w:pBdr"))
    bottom = etree.SubElement(pBdr, qn("w:bottom"))
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")    # half-points: 4 = 0.5pt
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), hex_color)
