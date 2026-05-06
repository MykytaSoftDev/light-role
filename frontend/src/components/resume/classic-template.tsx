/**
 * TAILOR-4 — ClassicTemplate
 *
 * Pure, server-renderable React component that produces the resume's HTML
 * for both the browser preview and the Puppeteer PDF pipeline.
 *
 * Visual contract: see `docs/v2/specs/classic-template-spec.md`. Every value
 * (sizes, spacing, colors, page-break rules) is sourced from that spec.
 *
 * Rules enforced here:
 *   - No `"use client"`, no hooks, no event handlers — pure props -> JSX.
 *   - No `dark:` Tailwind variants anywhere inside `.resume-document`.
 *   - HTML content for `summary`, `description`, `details[]` is treated as
 *     pre-sanitized (sanitization happens upstream — TAILOR-10 will integrate
 *     DOMPurify on save). DO NOT sanitize again here.
 *   - Empty sections render NOTHING (no header, no rule).
 *   - `personal_info` is always rendered as the header, NOT in `sections_order`.
 *   - `font` prop only swaps `font-family` via `--resume-font`; the type
 *     scale never changes per font.
 */
import * as React from "react";

import type {
  AchievementEntry,
  CertificateEntry,
  EducationEntry,
  EmploymentEntry,
  LanguageEntry,
  PersonalInfo,
  ProfileData,
  ProjectEntry,
  SkillEntry,
  VolunteerEntry,
} from "@/lib/profile-api";
import type { ResumeFont } from "@/lib/fonts/resume-fonts";
import { getResumeFontFamily } from "@/lib/fonts/resume-fonts";

export type { ResumeFont };
export type ResumeTemplate = "classic";

export interface ClassicTemplateProps {
  data: ProfileData;
  font: ResumeFont;
  /** Order in which body sections render. `personal_info` is NOT included. */
  sections_order: string[];
  /** Always "classic" in MVP; reserved for future templates. */
  template: ResumeTemplate;
  /**
   * ISO date (`YYYY-MM-DD`) used to mark expired certificates. Passed in by
   * the caller so the component stays pure (no `Date.now()` in render).
   * When omitted, certificates are never marked expired.
   */
  today?: string;
}

// ---------------------------------------------------------------------------
// Date helpers (colocated; TAILOR-12 needs the exact format the template uses)
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats a partial-or-full ISO date string into the resume's display format
 * `MMM YYYY` (e.g. "Jan 2022"). Accepts:
 *   - `"YYYY-MM"` (preferred — matches PRD month/year picker)
 *   - `"YYYY-MM-DD"` (full ISO)
 *   - `"YYYY"` alone (returns just "YYYY" — month unknown)
 *   - `null` / `undefined` / "" — returns "" unless `endsCurrent` is true
 *
 * When `opts.endsCurrent` is true, returns "Present" regardless of value.
 * This is the only date formatter the template uses; bare-year achievements
 * call this with no month and get a year-only string.
 */
export function formatResumeDate(
  value: string | null | undefined,
  opts?: { endsCurrent?: boolean }
): string {
  if (opts?.endsCurrent) return "Present";
  if (!value) return "";
  // YYYY only
  const yearOnly = /^(\d{4})$/.exec(value);
  if (yearOnly) return yearOnly[1];
  // YYYY-MM or YYYY-MM-DD
  const ymd = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);
  if (ymd) {
    const year = ymd[1];
    const monthIdx = parseInt(ymd[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_ABBR[monthIdx]} ${year}`;
    }
    return year;
  }
  // Best effort: try Date — guard with isNaN so junk strings return raw value.
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  }
  return value;
}

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent?: boolean
): string {
  const left = formatResumeDate(start);
  const right = isCurrent
    ? formatResumeDate(null, { endsCurrent: true })
    : formatResumeDate(end);
  if (!left && !right) return "";
  if (!left) return right;
  if (!right) return left;
  return `${left} – ${right}`;
}

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

/**
 * Joins non-empty strings with a middle dot separator. Used for the contact
 * row and any "company · location"-style subtitles. Filters falsy values so
 * absent items collapse cleanly without leading/trailing/double dots.
 */
function joinWithDot(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");
}

/** Lowercase, drop protocol and leading www. — for displayed link text. */
function displayUrl(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/** Bare hostname (no path), used as a final fallback for social link labels. */
function hostnameOnly(raw: string): string {
  const stripped = raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  const slash = stripped.indexOf("/");
  return slash === -1 ? stripped : stripped.slice(0, slash);
}

/** Title-case each space-separated token (preserves internal punctuation). */
function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((tok) => (tok.length === 0 ? tok : tok[0].toUpperCase() + tok.slice(1)))
    .join(" ");
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  twitter: "X",
  x: "X",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
  bsky: "Bluesky",
  dribbble: "Dribbble",
  behance: "Behance",
  medium: "Medium",
  dev: "Dev.to",
  "dev.to": "Dev.to",
  stackoverflow: "Stack Overflow",
  "stack overflow": "Stack Overflow",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  personal: "Website",
  "personal website": "Website",
  portfolio: "Portfolio",
  blog: "Blog",
};

/**
 * Maps free-form `platform` strings to display labels.
 * Falls back to title-case of the platform string if unknown; if the
 * platform string is empty after trimming, falls back to the URL's bare hostname.
 */
function formatPlatformLabel(platform: string, url: string): string {
  const normalized = (platform ?? "").trim().toLowerCase();
  if (normalized === "") {
    return hostnameOnly(url);
  }
  const known = PLATFORM_LABELS[normalized];
  if (known) return known;
  const titled = titleCase(normalized).trim();
  if (titled === "") return hostnameOnly(url);
  return titled;
}

/**
 * Renders pre-sanitized HTML inline. Trust boundary: callers must have
 * sanitized this string already (TAILOR-10 will wire DOMPurify on save).
 * DO NOT add sanitization here.
 */
function HtmlContent({
  html,
  as: Tag = "div",
  className,
}: {
  html: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}) {
  const Comp = Tag as keyof React.JSX.IntrinsicElements;
  // pre-sanitized upstream (TAILOR-10 wires DOMPurify on save)
  return React.createElement(Comp, {
    className,
    dangerouslySetInnerHTML: { __html: html },
  });
}

// ---------------------------------------------------------------------------
// Header (personal info) — always rendered, never in sections_order
// ---------------------------------------------------------------------------

function Header({ info }: { info: PersonalInfo }) {
  const contactItems: Array<{ key: string; node: React.ReactNode }> = [];
  if (info.email) {
    contactItems.push({
      key: "email",
      node: (
        <a className="resume-link" href={`mailto:${info.email}`}>
          {info.email}
        </a>
      ),
    });
  }
  if (info.phone) {
    contactItems.push({ key: "phone", node: info.phone });
  }
  if (info.location) {
    contactItems.push({ key: "location", node: info.location });
  }
  for (const link of info.social_links ?? []) {
    contactItems.push({
      key: `social-${link.id ?? link.url}`,
      node: (
        <a className="resume-link" href={link.url}>
          {formatPlatformLabel(link.platform, link.url)}
        </a>
      ),
    });
  }

  return (
    <header className="resume-header">
      <h1 className="resume-name">{info.full_name || ""}</h1>
      {/* job_title isn't part of the v2.1 PersonalInfo schema; intentionally omitted. */}
      {contactItems.length > 0 && (
        <p className="resume-contact">
          {contactItems.map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && <span className="resume-contact-sep">{" · "}</span>}
              <span className="resume-contact-item">{item.node}</span>
            </React.Fragment>
          ))}
        </p>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="resume-section">
      <h2 className="resume-section-header">{title}</h2>
      <div className="resume-section-body">{children}</div>
    </section>
  );
}

function EntryRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="resume-entry-row">
      <div className="resume-entry-row-left">{left}</div>
      {right ? <div className="resume-entry-row-right">{right}</div> : null}
    </div>
  );
}

/** Bullet list rendered from Tiptap-style HTML strings (pre-sanitized). */
function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="resume-bullets">
      {items.map((html, i) => (
        <HtmlContent key={i} as="li" html={html} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Section renderers (one per known key). Each returns null when empty.
// ---------------------------------------------------------------------------

function renderSummary(data: ProfileData): React.ReactNode {
  const text = (data.summary ?? "").trim();
  if (!text) return null;
  return (
    <SectionShell title="Summary">
      <HtmlContent className="resume-summary" html={data.summary} />
    </SectionShell>
  );
}

function EmploymentArticle({ entry }: { entry: EmploymentEntry }) {
  const dates = formatDateRange(entry.start_date, entry.end_date, entry.is_current);
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.role}</span>}
        right={dates ? <span className="resume-entry-meta">{dates}</span> : undefined}
      />
      {(entry.company || entry.location) && (
        <p className="resume-entry-subtitle">
          {joinWithDot([entry.company, entry.location ?? null])}
        </p>
      )}
      <BulletList items={entry.details ?? []} />
    </article>
  );
}

function renderEmployment(data: ProfileData): React.ReactNode {
  if (!data.employment?.length) return null;
  return (
    <SectionShell title="Experience">
      {data.employment.map((e, i) => (
        <EmploymentArticle key={e.id ?? i} entry={e} />
      ))}
    </SectionShell>
  );
}

function EducationArticle({ entry }: { entry: EducationEntry }) {
  const dates = formatDateRange(entry.start_date, entry.end_date, entry.is_current);
  const hasDescription = !!(entry.description && entry.description.trim());
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.degree}</span>}
        right={dates ? <span className="resume-entry-meta">{dates}</span> : undefined}
      />
      {(entry.institution || entry.location) && (
        <p className="resume-entry-subtitle">
          {joinWithDot([entry.institution, entry.location ?? null])}
        </p>
      )}
      {!hasDescription && entry.field_of_study ? (
        <p className="resume-entry-body">Field: {entry.field_of_study}</p>
      ) : null}
      {hasDescription && entry.field_of_study ? (
        <p className="resume-entry-body">
          <em>{entry.field_of_study}.</em>{" "}
          <HtmlContent as="span" html={entry.description ?? ""} />
        </p>
      ) : null}
      {hasDescription && !entry.field_of_study ? (
        <HtmlContent as="div" className="resume-entry-body" html={entry.description ?? ""} />
      ) : null}
    </article>
  );
}

function renderEducation(data: ProfileData): React.ReactNode {
  if (!data.education?.length) return null;
  return (
    <SectionShell title="Education">
      {data.education.map((e, i) => (
        <EducationArticle key={e.id ?? i} entry={e} />
      ))}
    </SectionShell>
  );
}

function renderSkills(data: ProfileData): React.ReactNode {
  const skills = (data.skills ?? []).filter((s: SkillEntry) => s.name?.trim());
  if (!skills.length) return null;
  return (
    <SectionShell title="Skills">
      <p className="resume-skills">{skills.map((s) => s.name).join(", ")}</p>
    </SectionShell>
  );
}

function renderLanguages(data: ProfileData): React.ReactNode {
  const langs = (data.languages ?? []).filter((l: LanguageEntry) => l.name?.trim());
  if (!langs.length) return null;
  return (
    <SectionShell title="Languages">
      {/* Per spec §5.5: flat bulleted list, name only, no proficiency. */}
      <ul className="resume-bullets">
        {langs.map((l, i) => (
          <li key={l.id ?? i}>
            <p>{l.name}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/**
 * Lexicographic comparison on `YYYY-MM[-DD]` strings: the first 10 characters
 * of an ISO date sort the same way they compare as dates, so we can detect
 * "in the past" without instantiating a `Date` (which would be an impure
 * call in render). Returns true when `iso` is strictly before `today`.
 */
function isIsoDateBefore(iso: string, today: string): boolean {
  return iso.slice(0, 10) < today.slice(0, 10);
}

function CertificateArticle({
  entry,
  today,
}: {
  entry: CertificateEntry;
  today: string;
}) {
  const issued = formatResumeDate(entry.issue_date);
  let expiredSuffix: React.ReactNode = null;
  if (entry.expiry_date && isIsoDateBefore(entry.expiry_date, today)) {
    expiredSuffix = <span className="resume-entry-faint"> (expired)</span>;
  }
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.name}</span>}
        right={
          issued ? (
            <span className="resume-entry-meta">
              {issued}
              {expiredSuffix}
            </span>
          ) : undefined
        }
      />
      {entry.issuer ? <p className="resume-entry-subtitle">{entry.issuer}</p> : null}
      {entry.credential_url ? (
        <p className="resume-entry-microtype">
          <a className="resume-link" href={entry.credential_url}>
            {displayUrl(entry.credential_url)}
          </a>
        </p>
      ) : null}
    </article>
  );
}

function renderCertificates(data: ProfileData, today: string): React.ReactNode {
  if (!data.certificates?.length) return null;
  return (
    <SectionShell title="Certificates">
      {data.certificates.map((c, i) => (
        <CertificateArticle key={c.id ?? i} entry={c} today={today} />
      ))}
    </SectionShell>
  );
}

function ProjectArticle({ entry }: { entry: ProjectEntry }) {
  const dates = formatDateRange(entry.start_date, entry.end_date, entry.is_current);
  const subtitleParts: string[] = [];
  if (entry.role) subtitleParts.push(entry.role);
  if (entry.technologies?.length) subtitleParts.push(entry.technologies.join(", "));
  const links: React.ReactNode[] = [];
  if (entry.url) {
    links.push(
      <a key="url" className="resume-link" href={entry.url}>
        {displayUrl(entry.url)}
      </a>
    );
  }
  if (entry.repository_url) {
    links.push(
      <a key="repo" className="resume-link" href={entry.repository_url}>
        {displayUrl(entry.repository_url)}
      </a>
    );
  }
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.name}</span>}
        right={dates ? <span className="resume-entry-meta">{dates}</span> : undefined}
      />
      {subtitleParts.length > 0 && (
        <p className="resume-entry-subtitle">{subtitleParts.join(" · ")}</p>
      )}
      {links.length > 0 && (
        <p className="resume-entry-microtype">
          {links.map((node, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>{" · "}</span>}
              {node}
            </React.Fragment>
          ))}
        </p>
      )}
      <BulletList items={entry.details ?? []} />
      {entry.description && entry.description.trim() ? (
        <HtmlContent as="div" className="resume-entry-body" html={entry.description} />
      ) : null}
    </article>
  );
}

function renderProjects(data: ProfileData): React.ReactNode {
  if (!data.projects?.length) return null;
  return (
    <SectionShell title="Projects">
      {data.projects.map((p, i) => (
        <ProjectArticle key={p.id ?? i} entry={p} />
      ))}
    </SectionShell>
  );
}

function AchievementArticle({ entry }: { entry: AchievementEntry }) {
  const date = formatResumeDate(entry.date);
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.title}</span>}
        right={date ? <span className="resume-entry-meta">{date}</span> : undefined}
      />
      {entry.issuer ? <p className="resume-entry-subtitle">{entry.issuer}</p> : null}
      {entry.description ? (
        <HtmlContent as="div" className="resume-entry-body" html={entry.description} />
      ) : null}
    </article>
  );
}

function renderAchievements(data: ProfileData): React.ReactNode {
  if (!data.achievements?.length) return null;
  return (
    <SectionShell title="Achievements">
      {data.achievements.map((a, i) => (
        <AchievementArticle key={a.id ?? i} entry={a} />
      ))}
    </SectionShell>
  );
}

function VolunteerArticle({ entry }: { entry: VolunteerEntry }) {
  const dates = formatDateRange(entry.start_date, entry.end_date, entry.is_current);
  return (
    <article className="resume-entry">
      <EntryRow
        left={<span className="resume-entry-title">{entry.role}</span>}
        right={dates ? <span className="resume-entry-meta">{dates}</span> : undefined}
      />
      {(entry.organization || entry.location) && (
        <p className="resume-entry-subtitle">
          {joinWithDot([entry.organization, entry.location ?? null])}
        </p>
      )}
      <BulletList items={entry.details ?? []} />
    </article>
  );
}

function renderVolunteer(data: ProfileData): React.ReactNode {
  if (!data.volunteer?.length) return null;
  return (
    <SectionShell title="Volunteer">
      {data.volunteer.map((v, i) => (
        <VolunteerArticle key={v.id ?? i} entry={v} />
      ))}
    </SectionShell>
  );
}

// Typed map of section-key -> render function. Adding a section is a one-liner.
// All renderers accept (data, today) for uniformity even when `today` is unused.
type SectionRenderer = (data: ProfileData, today: string) => React.ReactNode;
const SECTION_RENDERERS: Record<string, SectionRenderer> = {
  summary: (d) => renderSummary(d),
  employment: (d) => renderEmployment(d),
  education: (d) => renderEducation(d),
  skills: (d) => renderSkills(d),
  languages: (d) => renderLanguages(d),
  certificates: (d, t) => renderCertificates(d, t),
  projects: (d) => renderProjects(d),
  achievements: (d) => renderAchievements(d),
  volunteer: (d) => renderVolunteer(d),
};

// ---------------------------------------------------------------------------
// Inline static styles (scoped under .resume-document so they don't leak)
// ---------------------------------------------------------------------------

/**
 * Important: every selector must be prefixed with `.resume-document` so the
 * styles do not leak when this component is mounted inside the editor app.
 * The component renders this <style> inline so `react-dom/server.renderToStaticMarkup`
 * carries the CSS into the Puppeteer pipeline without relying on Tailwind.
 */
const STATIC_STYLES = `
.resume-document {
  /* Palette — independent of app theme tokens. */
  --resume-paper: #FFFFFF;
  --resume-ink: #111827;
  --resume-muted: #4B5563;
  --resume-faint: #9CA3AF;
  --resume-rule: #E5E7EB;
  --resume-accent: #4F46E5;
  --resume-link: #1F2937;
  /* Keyword highlighter palette (see spec §7) */
  --keyword-color-1: #FEF3C7;
  --keyword-color-2: #DBEAFE;
  --keyword-color-3: #D1FAE5;
  --keyword-color-4: #FCE7F3;
  --keyword-color-5: #E0E7FF;
  --keyword-color-6: #FFEDD5;
  --keyword-color-7: #CFFAFE;
  --keyword-color-8: #EDE9FE;

  width: 210mm;
  min-height: 297mm;
  padding: 14mm;
  background: var(--resume-paper);
  color: var(--resume-ink);
  box-sizing: border-box;
  font-family: var(--resume-font, "Inter"), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 10.5pt;
  line-height: 1.35;
  orphans: 2;
  widows: 2;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.resume-document * { box-sizing: border-box; }
.resume-document p { margin: 0; }

/* Header (personal info) */
.resume-document .resume-header { margin-bottom: 18pt; }
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
.resume-document .resume-contact-item { display: inline; }
.resume-document .resume-contact-sep { color: var(--resume-faint); }

/* Section shell */
.resume-document .resume-section { margin-top: 18pt; }
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
  break-after: avoid;
  page-break-after: avoid;
}
.resume-document .resume-section-body > * + * { margin-top: 10pt; }

/* Entries */
.resume-document .resume-entry {
  break-inside: avoid;
  page-break-inside: avoid;
}
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
.resume-document .resume-entry-faint {
  color: var(--resume-faint);
  font-size: 9pt;
}

/* Summary body */
.resume-document .resume-summary {
  font-size: 10.5pt;
  line-height: 1.4;
  color: var(--resume-ink);
}
.resume-document .resume-summary p + p { margin-top: 6pt; }

/* Skills inline list */
.resume-document .resume-skills {
  font-size: 10.5pt;
  line-height: 1.4;
  color: var(--resume-ink);
}

/* Bullet lists (Tiptap-style) */
.resume-document .resume-bullets,
.resume-document ul {
  list-style: none;
  padding-left: 0;
  margin: 4pt 0 0 0;
}
.resume-document ul > li {
  position: relative;
  padding-left: 14pt;
  margin-bottom: 3pt;
  font-size: 10.5pt;
  line-height: 1.35;
}
.resume-document ul > li:last-child { margin-bottom: 0; }
.resume-document ul > li::before {
  content: "\\2022";
  position: absolute;
  left: 2pt;
  top: 0;
  color: var(--resume-muted);
  font-size: 11pt;
  line-height: 1.35;
}
.resume-document ul > li > p { margin: 0; }
.resume-document ul > li > p + p { margin-top: 3pt; }
/* Defensive: ignore nested bullets (TAILOR-10 enforces single-level) */
.resume-document ul ul { display: none; }

/* Links */
.resume-document a,
.resume-document .resume-link {
  color: var(--resume-link);
  text-decoration: underline;
  text-decoration-color: var(--resume-rule);
  text-underline-offset: 2px;
}

/* Keyword highlight host (TAILOR-12 marks land here) */
.resume-document mark[data-keyword] {
  background-color: var(--keyword-color-1);
  color: inherit;
  padding: 0.5pt 2pt;
  margin: 0 -2pt;
  border-radius: 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
.resume-document mark[data-keyword][data-color-id="1"] { background-color: var(--keyword-color-1); }
.resume-document mark[data-keyword][data-color-id="2"] { background-color: var(--keyword-color-2); }
.resume-document mark[data-keyword][data-color-id="3"] { background-color: var(--keyword-color-3); }
.resume-document mark[data-keyword][data-color-id="4"] { background-color: var(--keyword-color-4); }
.resume-document mark[data-keyword][data-color-id="5"] { background-color: var(--keyword-color-5); }
.resume-document mark[data-keyword][data-color-id="6"] { background-color: var(--keyword-color-6); }
.resume-document mark[data-keyword][data-color-id="7"] { background-color: var(--keyword-color-7); }
.resume-document mark[data-keyword][data-color-id="8"] { background-color: var(--keyword-color-8); }

/* Page setup + print media */
@page { size: A4; margin: 0; }
@media print {
  .resume-document {
    box-shadow: none;
    margin: 0;
  }
  [data-preview-only] { display: none !important; }
}
`;

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function ClassicTemplate(props: ClassicTemplateProps): React.JSX.Element {
  const { data, font, sections_order, today } = props;
  // When `today` isn't supplied we use a sentinel that never matches "in the
  // past" comparisons, so the (expired) badge is suppressed rather than
  // computed impurely. The wrapper component supplies a real value.
  const todayIso = today ?? "9999-12-31";

  const rootStyle: React.CSSProperties & Record<string, string> = {
    // Only the font-family changes per the `font` prop. The typographic
    // scale is identical for all 5 supported fonts (see spec §3).
    ["--resume-font" as string]: getResumeFontFamily(font),
  };

  return (
    <div className="resume-document" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: STATIC_STYLES }} />
      {data.personal_info ? <Header info={data.personal_info} /> : null}
      {sections_order.map((key) => {
        const renderer = SECTION_RENDERERS[key];
        if (!renderer) return null; // Unknown section keys are silently skipped.
        const node = renderer(data, todayIso);
        if (!node) return null;
        return <React.Fragment key={key}>{node}</React.Fragment>;
      })}
    </div>
  );
}

export default ClassicTemplate;
