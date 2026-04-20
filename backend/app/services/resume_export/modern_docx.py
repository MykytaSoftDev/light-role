"""
Modern resume template — DOCX builder.

Approximates the two-column PDF layout using a Word table where
the left cell has an indigo-tinted background (EEF2FF).
"""
from __future__ import annotations

import io

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from lxml import etree

from app.services.resume_export.types import ResumeData


def build_modern_docx(data: ResumeData) -> bytes:
    doc = Document()
    _configure_margins(doc)

    # ── Header row (full width, name + contact) ──────────────────────────────
    info = data.personal_info
    name_para = doc.add_paragraph()
    run = name_para.add_run((info.name or "").strip())
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)  # indigo-600

    contact_parts = [
        v for v in (info.email, info.phone, info.location, info.linkedin, info.website)
        if v and v.strip()
    ]
    if contact_parts:
        contact_para = doc.add_paragraph(" | ".join(contact_parts))
        for run in contact_para.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    # Separator line
    sep = doc.add_paragraph()
    _add_paragraph_bottom_border(sep, "4F46E5")

    # ── Two-column table ─────────────────────────────────────────────────────
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    _remove_table_borders(table)

    left_cell = table.cell(0, 0)
    right_cell = table.cell(0, 1)

    # Set column widths: left ~35%, right ~65% of 6.5" usable width
    left_cell.width = Inches(2.27)
    right_cell.width = Inches(4.23)

    # Indigo tint on left cell
    _set_cell_background(left_cell, "EEF2FF")

    # ── Left column content ──────────────────────────────────────────────────
    _clear_cell(left_cell)

    # Contact details
    _add_cell_heading(left_cell, "Contact")
    for label, value in [
        ("Email", info.email),
        ("Phone", info.phone),
        ("Location", info.location),
        ("LinkedIn", info.linkedin),
        ("Website", info.website),
    ]:
        if value and value.strip():
            p = left_cell.add_paragraph()
            label_run = p.add_run(f"{label}: ")
            label_run.bold = True
            label_run.font.size = Pt(9)
            value_run = p.add_run(value.strip())
            value_run.font.size = Pt(9)

    if data.skills:
        _add_cell_heading(left_cell, "Skills")
        p = left_cell.add_paragraph(", ".join(s for s in data.skills if s))
        for run in p.runs:
            run.font.size = Pt(9)

    if data.languages:
        _add_cell_heading(left_cell, "Languages")
        p = left_cell.add_paragraph(", ".join(lang for lang in data.languages if lang))
        for run in p.runs:
            run.font.size = Pt(9)

    if data.certifications:
        _add_cell_heading(left_cell, "Certifications")
        for cert in data.certifications:
            parts = [x for x in (cert.name, cert.issuer, cert.date) if x and x.strip()]
            if parts:
                p = left_cell.add_paragraph(" | ".join(parts))
                for run in p.runs:
                    run.font.size = Pt(9)

    # ── Right column content ─────────────────────────────────────────────────
    _clear_cell(right_cell)

    if data.summary and data.summary.strip():
        _add_cell_heading(right_cell, "Summary")
        p = right_cell.add_paragraph(data.summary.strip())
        for run in p.runs:
            run.font.size = Pt(10)

    if data.experience:
        _add_cell_heading(right_cell, "Experience")
        for item in data.experience:
            _render_experience(right_cell, item)

    if data.education:
        _add_cell_heading(right_cell, "Education")
        for item in data.education:
            _render_education(right_cell, item)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _configure_margins(doc: Document) -> None:
    section = doc.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)


def _clear_cell(cell) -> None:
    """Remove the default empty paragraph added by python-docx in new cells."""
    for para in list(cell.paragraphs):
        p = para._element
        p.getparent().remove(p)


def _add_cell_heading(cell, text: str) -> None:
    p = cell.add_paragraph()
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)
    _add_paragraph_bottom_border(p, "C7D2FE")


def _render_experience(cell, item) -> None:
    title = (item.title or "").strip()
    company = (item.company or "").strip()
    start_date = (item.start_date or "").strip()
    end_date = ("Present" if item.current else (item.end_date or "")).strip()

    heading_parts = [x for x in (title, company) if x]
    heading_text = " \u2014 ".join(heading_parts) or "Untitled Position"

    p = cell.add_paragraph()
    run = p.add_run(heading_text)
    run.bold = True
    run.font.size = Pt(10)

    date_parts = [x for x in (start_date, end_date) if x]
    if date_parts:
        dp = cell.add_paragraph(" \u2013 ".join(date_parts))
        for run in dp.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    if item.description and item.description.strip():
        desc_p = cell.add_paragraph(item.description.strip())
        for run in desc_p.runs:
            run.font.size = Pt(10)

    for ach in (item.achievements or []):
        if ach and ach.strip():
            cell.add_paragraph(ach.strip(), style="List Bullet")


def _render_education(cell, item) -> None:
    institution = (item.institution or "").strip()
    degree_parts = [x for x in (item.degree or "", item.field or "") if x.strip()]
    degree_text = ", ".join(degree_parts)
    heading_parts = [x for x in (institution, degree_text) if x]
    heading_text = " \u2014 ".join(heading_parts) or "Untitled"

    p = cell.add_paragraph()
    run = p.add_run(heading_text)
    run.bold = True
    run.font.size = Pt(10)

    date_parts = [x for x in (item.start_date or "", item.end_date or "") if x.strip()]
    meta_parts = []
    if date_parts:
        meta_parts.append(" \u2013 ".join(date_parts))
    if item.gpa:
        meta_parts.append(f"GPA: {item.gpa}")
    if meta_parts:
        mp = cell.add_paragraph(" | ".join(meta_parts))
        for run in mp.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)


def _set_cell_background(cell, hex_color: str) -> None:
    """Set cell fill color via w:shd XML element."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = etree.SubElement(tcPr, qn("w:shd"))
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)


def _remove_table_borders(table) -> None:
    """Remove all visible borders from a table."""
    tbl = table._tbl
    tblPr = tbl.find(qn("w:tblPr"))
    if tblPr is None:
        tblPr = etree.SubElement(tbl, qn("w:tblPr"))
    tblBdr = etree.SubElement(tblPr, qn("w:tblBorders"))
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        border = etree.SubElement(tblBdr, qn(f"w:{side}"))
        border.set(qn("w:val"), "none")


def _add_paragraph_bottom_border(para, hex_color: str = "AAAAAA") -> None:
    pPr = para._p.get_or_add_pPr()
    pBdr = etree.SubElement(pPr, qn("w:pBdr"))
    bottom = etree.SubElement(pBdr, qn("w:bottom"))
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), hex_color)
