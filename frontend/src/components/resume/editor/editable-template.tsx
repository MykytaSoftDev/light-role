"use client";

/**
 * TAILOR-10 — EditableTemplate.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §13 #8 ("Don't extend
 * ClassicTemplate; use a sibling EditableTemplate").
 *
 * Mirrors `<ClassicTemplate>`'s structure and CSS-class scaffolding so the
 * editing experience is "edit in place" inside the document — but every
 * value is rendered via an editable widget instead of a read-only span.
 *
 * Sections render in `sections_order`. Empty sections still render in Edit
 * mode (per spec §7.11) so the user can populate them inline.
 *
 * The personal-info HEADER is always rendered above body sections, never
 * in the order array (matching `ClassicTemplate`).
 *
 * Performance:
 *   - Each section editor is wrapped in `React.memo` and only sees the slice
 *     of `data` it owns (employment[] OR education[] OR …) — typing in the
 *     summary does not re-render the employment editor.
 *   - Tiptap instances are stable per-entry-id (the editor stays mounted
 *     across keystrokes; React only re-renders the wrapper).
 */
import * as React from "react";

import type { ProfileData } from "@/lib/profile-api";
import type { ResumeFont } from "@/lib/fonts/resume-fonts";
import { getResumeFontFamily } from "@/lib/fonts/resume-fonts";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { PersonalInfoEditor } from "./sections/personal-info-editor";
import { SummaryEditor } from "./sections/summary-editor";
import { EmploymentEditor } from "./sections/employment-editor";
import { EducationEditor } from "./sections/education-editor";
import { SkillsEditor } from "./sections/skills-editor";
import { LanguagesEditor } from "./sections/languages-editor";
import { CertificatesEditor } from "./sections/certificates-editor";
import { ProjectsEditor } from "./sections/projects-editor";
import { AchievementsEditor } from "./sections/achievements-editor";
import { VolunteerEditor } from "./sections/volunteer-editor";

export interface EditableTemplateProps {
  data: ProfileData;
  font: ResumeFont;
  /** Order in which body sections render. Personal info is NOT included. */
  sections_order: string[];
  /** Called whenever any field, entry, or section changes. */
  onChange: (data: ProfileData) => void;
  /**
   * Called with the current validity status of the document. Currently only
   * gated on `personal_info.email` (per task spec Step 10).
   */
  onValidityChange?: (isValid: boolean) => void;
  /**
   * TAILOR-12 — Matched keywords from the AI tailor pipeline. Threaded down
   * to each Tiptap-backed section editor so the decoration plugin paints
   * highlights inline. Pass `undefined` to disable highlighting.
   */
  keywords?: MatchedKeyword[];
}

/**
 * Top-level editable mirror. The CSS class scaffolding (`.resume-document`,
 * `.resume-section`, `.resume-entry-row`, etc.) is shared with ClassicTemplate
 * — those styles are emitted by ClassicTemplate's inline `<style>` block
 * during the SAME page (since ResumePreview renders a ClassicTemplate-shaped
 * tree elsewhere on the same page in Preview mode).
 *
 * However, in Edit mode we don't render ClassicTemplate at all, so we need
 * to ensure the `.resume-document` styles are present. Solution: render an
 * invisible ClassicTemplate-style `<style>` here? — that would duplicate the
 * 200-line CSS block. Cleaner: import the same CSS via a module side-effect
 * OR rely on the fact that `<EditableTemplate>` is mounted INSIDE a sibling
 * component tree where ClassicTemplate already injected its inline styles.
 *
 * Resolved: ClassicTemplate's inline style is scoped to `.resume-document`
 * and stays in the DOM as long as ClassicTemplate is mounted. In Edit mode
 * we are NOT mounting ClassicTemplate (per editor-shell.tsx swap), so we
 * inline the SAME CSS block here. To avoid duplication we re-export it.
 */
export function EditableTemplate({
  data,
  font,
  sections_order,
  onChange,
  onValidityChange,
  keywords,
}: EditableTemplateProps) {
  const rootStyle: React.CSSProperties & Record<string, string> = {
    ["--resume-font" as string]: getResumeFontFamily(font),
  };

  // Per-section onChange helpers. We rebuild on every `data` change because
  // each child's onChange must close over the latest `data`. The section
  // editors are wrapped in `React.memo` and Tiptap editor wrappers manage
  // their own throttling; the cost of a top-level re-render is just the
  // virtual-DOM diff, which is cheap.
  const onPersonalInfoChange = React.useCallback(
    (next: ProfileData["personal_info"]) => {
      onChange({ ...data, personal_info: next ?? null });
    },
    [data, onChange]
  );
  const onSummaryChange = React.useCallback(
    (next: string) => {
      onChange({ ...data, summary: next });
    },
    [data, onChange]
  );
  const onEmploymentChange = React.useCallback(
    (next: ProfileData["employment"]) => {
      onChange({ ...data, employment: next });
    },
    [data, onChange]
  );
  const onEducationChange = React.useCallback(
    (next: ProfileData["education"]) => {
      onChange({ ...data, education: next });
    },
    [data, onChange]
  );
  const onSkillsChange = React.useCallback(
    (next: ProfileData["skills"]) => {
      onChange({ ...data, skills: next });
    },
    [data, onChange]
  );
  const onLanguagesChange = React.useCallback(
    (next: ProfileData["languages"]) => {
      onChange({ ...data, languages: next });
    },
    [data, onChange]
  );
  const onCertificatesChange = React.useCallback(
    (next: ProfileData["certificates"]) => {
      onChange({ ...data, certificates: next });
    },
    [data, onChange]
  );
  const onProjectsChange = React.useCallback(
    (next: ProfileData["projects"]) => {
      onChange({ ...data, projects: next });
    },
    [data, onChange]
  );
  const onAchievementsChange = React.useCallback(
    (next: ProfileData["achievements"]) => {
      onChange({ ...data, achievements: next });
    },
    [data, onChange]
  );
  const onVolunteerChange = React.useCallback(
    (next: ProfileData["volunteer"]) => {
      onChange({ ...data, volunteer: next });
    },
    [data, onChange]
  );

  // Renderer dispatch — match ClassicTemplate's section renderer map.
  function renderSection(key: string): React.ReactNode {
    switch (key) {
      case "summary":
        return (
          <SummaryEditor
            value={data.summary ?? ""}
            onChange={onSummaryChange}
            keywords={keywords}
          />
        );
      case "employment":
        return (
          <EmploymentEditor
            value={data.employment ?? []}
            onChange={onEmploymentChange}
            keywords={keywords}
          />
        );
      case "education":
        return (
          <EducationEditor
            value={data.education ?? []}
            onChange={onEducationChange}
            keywords={keywords}
          />
        );
      case "skills":
        return (
          <SkillsEditor value={data.skills ?? []} onChange={onSkillsChange} />
        );
      case "languages":
        return (
          <LanguagesEditor
            value={data.languages ?? []}
            onChange={onLanguagesChange}
          />
        );
      case "certificates":
        return (
          <CertificatesEditor
            value={data.certificates ?? []}
            onChange={onCertificatesChange}
          />
        );
      case "projects":
        return (
          <ProjectsEditor
            value={data.projects ?? []}
            onChange={onProjectsChange}
            keywords={keywords}
          />
        );
      case "achievements":
        return (
          <AchievementsEditor
            value={data.achievements ?? []}
            onChange={onAchievementsChange}
            keywords={keywords}
          />
        );
      case "volunteer":
        return (
          <VolunteerEditor
            value={data.volunteer ?? []}
            onChange={onVolunteerChange}
            keywords={keywords}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="resume-document" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: EDITABLE_STYLES }} />
      <PersonalInfoEditor
        value={data.personal_info ?? null}
        onChange={onPersonalInfoChange}
        onValidityChange={onValidityChange}
      />
      {sections_order.map((key) => {
        const node = renderSection(key);
        if (!node) return null;
        return <React.Fragment key={key}>{node}</React.Fragment>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles for the editable surface.
//
// Mirrors ClassicTemplate's `.resume-document` scaffolding so the editor
// looks identical to the preview document. Kept in sync manually — when
// ClassicTemplate's STATIC_STYLES change, this block must be updated too.
// ---------------------------------------------------------------------------

const EDITABLE_STYLES = `
.resume-document {
  --resume-paper: #FFFFFF;
  --resume-ink: #111827;
  --resume-muted: #4B5563;
  --resume-faint: #9CA3AF;
  --resume-rule: #E5E7EB;
  --resume-accent: #4F46E5;
  --resume-link: #1F2937;

  /*
   * Force light-theme shadcn surface tokens inside the document — the paper
   * is always white regardless of app theme, so any editor control rendered
   * inside (Switch, ChipInputField, chip surfaces, etc.) must read light
   * values. Without these overrides the dark-theme tokens cascade in and
   * paint black backgrounds on top of the white page.
   *
   * Scope: only surface/border tokens. Primary stays untouched so the focus
   * ring and Switch's checked state keep their accent color.
   */
  --background: oklch(98% 0 0);
  --foreground: oklch(10% 0.01 286);
  --card: oklch(96% 0.005 286);
  --card-foreground: oklch(10% 0.01 286);
  --popover: oklch(98% 0 0);
  --popover-foreground: oklch(10% 0.01 286);
  --secondary: oklch(92% 0.01 286);
  --secondary-foreground: oklch(10% 0.01 286);
  --muted: oklch(92% 0.01 286);
  --muted-foreground: oklch(45% 0.01 286);
  --accent: oklch(92% 0.01 286);
  --accent-foreground: oklch(10% 0.01 286);
  --border: oklch(88% 0.01 286);
  --input: oklch(88% 0.01 286);

  width: 210mm;
  min-height: 297mm;
  padding: 14mm;
  background: var(--resume-paper);
  color: var(--resume-ink);
  box-sizing: border-box;
  font-family: var(--resume-font, "Inter"), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 10.5pt;
  line-height: 1.35;
}
.resume-document * { box-sizing: border-box; }
.resume-document p { margin: 0; }

/* Header */
.resume-document .resume-header { margin-bottom: 18pt; position: relative; }
.resume-document .resume-name {
  margin: 0 0 4pt 0;
  font-size: 22pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--resume-ink);
}
.resume-document .resume-contact {
  font-size: 9.5pt;
  color: var(--resume-muted);
  line-height: 1.4;
}

/* Section shell */
.resume-document .resume-section { margin-top: 18pt; position: relative; }
.resume-document .resume-section:first-of-type { margin-top: 0; }
.resume-document .resume-section-header {
  margin: 0 0 6pt 0;
  padding-bottom: 4pt;
  border-bottom: 1px solid var(--resume-rule);
  font-size: 10pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.2;
  color: var(--resume-ink);
}
.resume-document .resume-section-body > * + * { margin-top: 10pt; }

/* Entries */
.resume-document .resume-entry-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12pt;
}
.resume-document .resume-entry-row-left { min-width: 0; }
.resume-document .resume-entry-row-right { flex-shrink: 0; text-align: right; }
.resume-document .resume-entry-title {
  font-size: 11pt;
  font-weight: 600;
  color: var(--resume-ink);
  line-height: 1.3;
  display: inline-block;
  width: 100%;
}
.resume-document .resume-entry-meta {
  font-size: 9.5pt;
  font-weight: 400;
  color: var(--resume-muted);
  line-height: 1.25;
}
.resume-document .resume-entry-subtitle {
  margin-top: 2pt;
  font-size: 10.5pt;
  font-weight: 500;
  color: var(--resume-ink);
  line-height: 1.3;
}
.resume-document .resume-entry-body {
  margin-top: 4pt;
  font-size: 10.5pt;
  line-height: 1.4;
  color: var(--resume-ink);
}
.resume-document .resume-entry-microtype {
  margin-top: 2pt;
  font-size: 9pt;
  color: var(--resume-muted);
  line-height: 1.3;
}

/* Summary */
.resume-document .resume-summary {
  font-size: 10.5pt;
  line-height: 1.4;
  color: var(--resume-ink);
}

/* Tiptap content reset */
.resume-document .tiptap-content { min-height: 1.4em; }
.resume-document .tiptap-content > p { margin: 0; }
.resume-document .tiptap-content > p + p { margin-top: 6pt; }

/* Tiptap bullet list */
.resume-document .tiptap-bullet-list,
.resume-document .resume-bullets,
.resume-document ul {
  list-style: none;
  padding-left: 0;
  margin: 4pt 0 0 0;
}
.resume-document ul > li,
.resume-document .tiptap-bullet-list > li {
  position: relative;
  padding-left: 14pt;
  margin-bottom: 3pt;
  font-size: 10.5pt;
  line-height: 1.35;
}
.resume-document ul > li:last-child { margin-bottom: 0; }
.resume-document ul > li::before,
.resume-document .tiptap-bullet-list > li::before {
  content: "\\2022";
  position: absolute;
  left: 2pt;
  top: 0;
  color: var(--resume-muted);
  font-size: 11pt;
  line-height: 1.35;
}
.resume-document ul > li > p,
.resume-document .tiptap-list-item > p { margin: 0; }
.resume-document ul ul { display: none; }

/* Inputs that adopt the surrounding text */
.resume-document input[type="text"] {
  background: transparent;
  color: inherit;
  font: inherit;
}
`;
