# Phase 6 QA Checklist — Resume Templates

## RT-6.1 DOCX Verification (automated)
Run: `pytest backend/tests/test_docx_all_templates.py -v`
- [ ] All 9 combinations (3 templates × 3 fixtures) produce valid .docx bytes
- [ ] Empty-sections test passes for all 3 templates

## RT-6.1 PDF Visual Review (manual)
For each combination below, open the resume editor, paste fixture data, export PDF, and review:

| Template | Fixture | PDF renders? | Visual OK? | Notes |
|----------|---------|-------------|------------|-------|
| Classic  | minimal | [ ] | [ ] | |
| Classic  | full    | [ ] | [ ] | |
| Classic  | edge    | [ ] | [ ] | Unicode chars OK? |
| Modern   | minimal | [ ] | [ ] | Left/right columns OK? |
| Modern   | full    | [ ] | [ ] | Indigo accents visible? |
| Modern   | edge    | [ ] | [ ] | Long content paginates? |
| Minimal  | minimal | [ ] | [ ] | Whitespace looks airy? |
| Minimal  | full    | [ ] | [ ] | Em-dash bullets visible? |
| Minimal  | edge    | [ ] | [ ] | Large name renders 28pt? |

## RT-6.2 Dark Theme Check
- [ ] Open resume editor in dark app theme
- [ ] Preview iframe background stays white (not dark)
- [ ] Template section headings, text colors unchanged in dark mode
- [ ] Switch between templates — preview always shows light paper

**Architecture note**: The preview uses `BlobProvider` which renders a PDF blob into an `<iframe>`. The iframe content is a PDF document with hardcoded `backgroundColor: "#FFFFFF"` in all template styles — it is fully isolated from the parent page's CSS. Dark theme cannot leak into the preview.

## RT-6.3 Backward Compatibility
- [ ] Existing resumes (created before this feature) load correctly
- [ ] `resume.template ?? "classic"` fallback active in frontend state init
- [ ] `resume.template or "classic"` fallback active in backend export endpoint
- [ ] `getTemplate(unknownId)` returns Classic template (not a crash)
- [ ] No DB migration required — `template` column existed with default 'classic'
- [ ] NULL template value: both FE and BE coerce to 'classic'
