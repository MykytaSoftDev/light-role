"""PDF and DOCX export for cover letters (plain text content)."""
from __future__ import annotations

# Reuse the same unicode→latin-1 map from pdf_export to handle AI-generated text
from app.utils.pdf_export import _UNICODE_MAP


def _sanitize(text: str) -> str:
    """Translate common unicode chars to latin-1 equivalents, then drop the rest."""
    return text.translate(_UNICODE_MAP).encode("latin-1", errors="replace").decode("latin-1")


def generate_cover_letter_pdf(content: str, name: str = "Cover Letter") -> bytes:
    """Generate a PDF from plain cover letter text using fpdf2."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(25, 25, 25)

    # Title
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, _sanitize(name), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # Body — multi_cell handles line wrapping
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, _sanitize(content))

    return bytes(pdf.output())


def generate_cover_letter_docx(content: str, name: str = "Cover Letter") -> bytes:
    """Generate a DOCX from plain cover letter text using python-docx."""
    import io

    from docx import Document
    from docx.shared import Inches, Pt

    doc = Document()

    # Set margins
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1.25)
    section.right_margin = Inches(1.25)

    # Title
    title_para = doc.add_paragraph()
    title_run = title_para.add_run(name)
    title_run.bold = True
    title_run.font.size = Pt(14)

    doc.add_paragraph()  # spacer

    # Body paragraphs — split on newlines to preserve line breaks
    for paragraph in content.split("\n"):
        p = doc.add_paragraph(paragraph.strip())
        for run in p.runs:
            run.font.size = Pt(11)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
