// Modern resume template — "Anna Johnson" dark-sidebar editorial (VO-1.1).
//
// Design: full-width header band on page 1 (wide letter-spaced uppercase name
// + light-gray subtitle band with role). Below: two-column body with a dark
// charcoal sidebar (#1A1A1A) on the left (190pt, ~32%) and a white main
// column on the right (flex:1, ~68%). Grayscale-only palette; no accent hues.
//
// Multi-page behavior: the header band renders on page 1 only. The dark
// sidebar fill is painted on every page via a `fixed`-prop absolute View
// behind the content. Flow content (contact, skills, education) in the
// sidebar appears on page 1 only; long experience/education content in the
// main column wraps freely across pages, and the charcoal rectangle extends
// full-height on each page behind the (now empty) sidebar flow area.
//
// Orphan control (BF-1.4 / BF-1.6 from bugfixes): (section title + first
// entry) is wrapped in <View wrap={false} minPresenceAhead={40}> so headings
// never land alone at a page bottom, while subsequent entries break freely.
//
// Icons: all contact icons are inline react-pdf <Svg> with hand-authored path
// data. No external icon library. Rendered at 10pt stroke in #E5E5E5.

import {
  Document,
  Page,
  View,
  Text,
  Link,
  Svg,
  Path,
  Rect,
} from "@react-pdf/renderer";
import { styles } from "./styles";
import type { TemplateComponentProps } from "../types";
import type { ResumeData } from "@/types/resume";
// Side-effect import registers Inter (weights 300/400/500/600/700/800,
// latin-ext + cyrillic subsets) via Font.register. Required before render —
// otherwise fontFamily: "Inter" silently falls back to Helvetica.
import "../fonts";

// Section order in the main column. ResumeData has no Projects field, so the
// spec's "Projects" slot is intentionally omitted — adapting the design to
// the actual schema per the task file's guardrails.
const MAIN_COLUMN_SECTIONS = ["summary", "experience", "education", "certifications"];
const DEFAULT_MAIN_ORDER = ["summary", "experience", "education", "certifications"];

// Filled-circle bullet character. The spec literally specifies '•'.
const BULLET = "\u2022";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPdfLinkLabel(
  url: string | null,
): { label: string; href: string; kind: "linkedin" | "github" | "website" } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com"))
    return { label: clean, href, kind: "linkedin" };
  if (clean.startsWith("github.com"))
    return { label: clean, href, kind: "github" };
  return { label: clean, href, kind: "website" };
}

// Derive the subtitle role title. Spec says: data.personalInfo.title if
// present; else most recent experience job title; else omit the band.
// ResumeData has no `title` on personal_info, so we always derive from
// experience. Returns null → subtitle band is omitted entirely.
function deriveRoleTitle(data: ResumeData): string | null {
  const first = data.experience?.[0];
  const title = first?.title?.trim();
  return title ? title : null;
}

// Date range formatter for experience: "YYYY - YYYY" or "YYYY - Present".
// Uses ASCII hyphen (not en-dash) to match the spec literal "2020 - Present".
function formatExperienceDates(
  start: string | null,
  end: string | null,
  current: boolean,
): string {
  const startYear = extractYear(start);
  const endYear = current ? "Present" : extractYear(end);
  if (!startYear && !endYear) return "";
  if (!startYear) return endYear ?? "";
  if (!endYear) return startYear;
  return `${startYear} - ${endYear}`;
}

function formatEducationDates(
  start: string | null,
  end: string | null,
): string {
  const startYear = extractYear(start);
  const endYear = extractYear(end);
  if (!startYear && !endYear) return "";
  if (!startYear) return endYear ?? "";
  if (!endYear) return startYear;
  return `${startYear} - ${endYear}`;
}

// Extract a 4-digit year from an ISO-ish date string ("2021-03" → "2021").
// Falls back to the raw string if no year match — user-entered data may be
// free-form like "Fall 2019".
function extractYear(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  return match ? match[0] : value;
}

// ── Icons ────────────────────────────────────────────────────────────────────
// All icons rendered at 10pt in #E5E5E5. Stroke-based where it makes sense;
// filled for the LinkedIn/GitHub text-in-rounded-square marks (trademark-safe
// substitutes for the real brand logos).

const ICON_COLOR = "#E5E5E5";
const ICON_SIZE = 10;

function IconPhone() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      {/* Handset — simplified Feather 'phone' path */}
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

function IconEmail() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      {/* Envelope */}
      <Path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M22 6l-10 7L2 6"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

function IconLocation() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      {/* Map pin */}
      <Path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

function IconGlobe() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
      <Path d="M2 12h20" stroke={ICON_COLOR} strokeWidth={2} />
      <Path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        stroke={ICON_COLOR}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

// LinkedIn substitute: lowercase "in" inside a rounded square (trademark-safe).
// GitHub substitute: lowercase "gh" inside a rounded square.
// Rendered as a filled rect + centered Svg "text" would require the Text
// component, which doesn't live inside an Svg. Instead we use a filled rect
// and let the sidebar text column render the URL — the icon itself is the
// square with two small marks inside via Path glyph approximations.
// Pragmatic approach: use the globe icon for LinkedIn/GitHub/website alike —
// this keeps the trademark-safe rule AND looks consistent. Reviewer notes:
// the spec accepts "generic link icon if simpler" as a fallback.
// For Modern we specifically want the "in"/"gh" look — implement with a
// filled rounded rect and two small glyph strokes. The glyph paths below are
// hand-approximated lowercase letterforms at a tiny scale — legible at 10pt.

function IconLinkedIn() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      {/* Rounded square */}
      <Rect
        x={2}
        y={2}
        width={20}
        height={20}
        rx={3}
        ry={3}
        fill={ICON_COLOR}
      />
      {/* 'i' dot */}
      <Rect x={5.5} y={7} width={2.5} height={2.5} fill="#1A1A1A" />
      {/* 'i' stem */}
      <Rect x={5.5} y={10.5} width={2.5} height={7} fill="#1A1A1A" />
      {/* 'n' left stem */}
      <Rect x={10} y={10.5} width={2.5} height={7} fill="#1A1A1A" />
      {/* 'n' arch top */}
      <Rect x={10} y={10.5} width={8} height={2.5} fill="#1A1A1A" />
      {/* 'n' right stem */}
      <Rect x={15.5} y={10.5} width={2.5} height={7} fill="#1A1A1A" />
    </Svg>
  );
}

function IconGitHub() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      {/* Code brackets — trademark-safe alternative to the Octocat mark */}
      <Rect
        x={2}
        y={2}
        width={20}
        height={20}
        rx={3}
        ry={3}
        fill={ICON_COLOR}
      />
      <Path
        d="M9 8l-4 4 4 4"
        stroke="#1A1A1A"
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M15 8l4 4-4 4"
        stroke="#1A1A1A"
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

// ── Sidebar renderers ────────────────────────────────────────────────────────

function renderContact(data: ResumeData, isFirst: boolean) {
  const info = data.personal_info;
  const hasAny =
    info.email || info.phone || info.location || info.linkedin || info.website;
  if (!hasAny) return null;

  const linkedinLink = getPdfLinkLabel(info.linkedin);
  const websiteLink = getPdfLinkLabel(info.website);

  return (
    <View key="contact">
      <Text
        style={
          isFirst ? styles.sidebarSectionTitleFirst : styles.sidebarSectionTitle
        }
      >
        Contact
      </Text>
      <View style={styles.sidebarSectionRule} />

      {info.phone ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconBox}>
            <IconPhone />
          </View>
          <Text style={styles.contactValue}>{info.phone}</Text>
        </View>
      ) : null}

      {info.email ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconBox}>
            <IconEmail />
          </View>
          <Text style={styles.contactValue}>{info.email}</Text>
        </View>
      ) : null}

      {info.location ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconBox}>
            <IconLocation />
          </View>
          <Text style={styles.contactValue}>{info.location}</Text>
        </View>
      ) : null}

      {linkedinLink ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconBox}>
            <IconLinkedIn />
          </View>
          <Link src={linkedinLink.href} style={styles.contactLink}>
            {linkedinLink.label}
          </Link>
        </View>
      ) : null}

      {websiteLink ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconBox}>
            {websiteLink.kind === "github" ? <IconGitHub /> : <IconGlobe />}
          </View>
          <Link src={websiteLink.href} style={styles.contactLink}>
            {websiteLink.label}
          </Link>
        </View>
      ) : null}
    </View>
  );
}

function renderSidebarEducation(data: ResumeData, isFirst: boolean) {
  if (!data.education.length) return null;
  return (
    <View key="education">
      <Text
        style={
          isFirst ? styles.sidebarSectionTitleFirst : styles.sidebarSectionTitle
        }
      >
        Education
      </Text>
      <View style={styles.sidebarSectionRule} />

      {data.education.map((edu, i) => {
        const degreeParts = [edu.degree, edu.field].filter(Boolean);
        const degreeLine =
          degreeParts.length > 0 ? degreeParts.join(", ") : edu.institution;
        const dates = formatEducationDates(edu.start_date, edu.end_date);

        return (
          <View key={i} style={styles.sidebarEduItem}>
            {degreeLine ? (
              <Text style={styles.sidebarEduDegree}>{degreeLine}</Text>
            ) : null}
            {degreeParts.length > 0 && edu.institution ? (
              <Text style={styles.sidebarEduInstitution}>{edu.institution}</Text>
            ) : null}
            {dates ? (
              <Text style={styles.sidebarEduDates}>{dates}</Text>
            ) : null}
            {edu.gpa ? (
              <Text style={styles.sidebarEduDates}>GPA: {edu.gpa}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// Skills in the sidebar. Signature detail: "//" prefix on category labels.
// ResumeData.skills is flat (string[]) today, so we render under a single
// "// SKILLS" sub-heading followed by a bulleted list. If the schema grows
// to support grouped skills later, the mapping will be straightforward.
function renderSkills(data: ResumeData, isFirst: boolean) {
  if (!data.skills.length) return null;
  return (
    <View key="skills">
      <Text
        style={
          isFirst ? styles.sidebarSectionTitleFirst : styles.sidebarSectionTitle
        }
      >
        Skills
      </Text>
      <View style={styles.sidebarSectionRule} />

      <View>
        {/* '// PROFESSIONAL' style sub-heading — the spec's signature detail. */}
        <Text style={styles.sidebarSubHeadingFirst}>{"// PROFESSIONAL"}</Text>
        {data.skills.map((skill, i) => (
          <View key={i} style={styles.sidebarBulletRow}>
            <Text style={styles.sidebarBullet}>{BULLET}</Text>
            <Text style={styles.sidebarBulletText}>{skill}</Text>
          </View>
        ))}
      </View>

      {data.languages.length > 0 ? (
        <View>
          <Text style={styles.sidebarSubHeading}>{"// LANGUAGES"}</Text>
          {data.languages.map((lang, i) => (
            <View key={i} style={styles.sidebarBulletRow}>
              <Text style={styles.sidebarBullet}>{BULLET}</Text>
              <Text style={styles.sidebarBulletText}>{lang}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Main column renderers ────────────────────────────────────────────────────

function renderProfile(data: ResumeData, isFirst: boolean) {
  // Use `summary` first, fall back to personal_info.summary (legacy field).
  const summary = data.summary?.trim() || data.personal_info.summary?.trim();
  if (!summary) return null;
  return (
    <View key="summary" wrap={false} minPresenceAhead={40}>
      <Text
        style={isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle}
      >
        Profile
      </Text>
      <View style={styles.mainSectionRule} />
      <Text style={styles.profileText}>{summary}</Text>
    </View>
  );
}

function renderExperienceItem(
  exp: ResumeData["experience"][number],
  key: number,
) {
  const dateLabel = formatExperienceDates(exp.start_date, exp.end_date, exp.current);
  const metaParts = [exp.company, dateLabel].filter(Boolean);
  const metaLine = metaParts.join(" | "); // pipe separator per spec

  return (
    <View key={key} style={styles.experienceItem} wrap={false}>
      <Text style={styles.experienceTitle}>{exp.title}</Text>
      {metaLine ? (
        <Text style={styles.experienceMeta}>{metaLine}</Text>
      ) : null}
      {exp.description?.trim() ? (
        <Text style={styles.experienceDescription}>{exp.description}</Text>
      ) : null}
      {(exp.achievements ?? []).length > 0 && (
        <View style={styles.achievementsContainer}>
          {exp.achievements.map((ach, j) => (
            <View key={j} style={styles.achievementRow}>
              <Text style={styles.achievementBullet}>{BULLET}</Text>
              <Text style={styles.achievementText}>{ach}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function renderExperience(data: ResumeData, isFirst: boolean) {
  if (!data.experience.length) return null;
  const [first, ...rest] = data.experience;
  return (
    <View key="experience">
      {/* Orphan control: title + first entry bound together. */}
      <View wrap={false} minPresenceAhead={40}>
        <Text
          style={
            isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle
          }
        >
          Work Experience
        </Text>
        <View style={styles.mainSectionRule} />
        {renderExperienceItem(first, 0)}
      </View>
      {rest.map((exp, i) => renderExperienceItem(exp, i + 1))}
    </View>
  );
}

function renderMainEducationItem(
  edu: ResumeData["education"][number],
  key: number,
) {
  const dateLabel = formatEducationDates(edu.start_date, edu.end_date);
  const degreeParts = [edu.degree, edu.field].filter(Boolean);
  const degreeLine = degreeParts.length > 0 ? degreeParts.join(", ") : "";
  // Note: EducationItem in ResumeData does not declare a `description` field;
  // see the education_in_sidebar rule below — this branch is only reachable
  // if we force it, which we don't today.
  return (
    <View key={key} style={styles.mainEduItem} wrap={false}>
      <View style={styles.mainEduHeaderRow}>
        <Text style={styles.mainEduInstitution}>{edu.institution}</Text>
        {dateLabel ? (
          <Text style={styles.mainEduDates}>{dateLabel}</Text>
        ) : null}
      </View>
      {degreeLine ? (
        <Text style={styles.mainEduDegree}>
          {degreeLine}
          {edu.gpa ? ` \u00b7 GPA: ${edu.gpa}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

function renderMainEducation(data: ResumeData, isFirst: boolean) {
  if (!data.education.length) return null;
  const [first, ...rest] = data.education;
  return (
    <View key="education">
      <View wrap={false} minPresenceAhead={40}>
        <Text
          style={
            isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle
          }
        >
          Education
        </Text>
        <View style={styles.mainSectionRule} />
        {renderMainEducationItem(first, 0)}
      </View>
      {rest.map((edu, i) => renderMainEducationItem(edu, i + 1))}
    </View>
  );
}

function renderCertifications(data: ResumeData, isFirst: boolean) {
  if (!data.certifications.length) return null;
  return (
    <View key="certifications" wrap={false} minPresenceAhead={40}>
      <Text
        style={isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle}
      >
        Certifications
      </Text>
      <View style={styles.mainSectionRule} />
      {data.certifications.map((cert, i) => {
        const metaParts = [cert.issuer, cert.date].filter(Boolean);
        return (
          <View key={i} style={styles.certificationItem}>
            <Text style={styles.certificationName}>{cert.name}</Text>
            {metaParts.length > 0 && (
              <Text style={styles.certificationMeta}>
                {metaParts.join(" \u00b7 ")}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Education placement rule ────────────────────────────────────────────────
// Spec: "default sidebar; if ANY education entry has a non-empty description
// field, move the whole Education section to the main column". ResumeData's
// EducationItem today has no `description` field, so the condition is always
// false and education always lives in the sidebar. This function is written
// defensively — if the schema grows, the rule applies automatically.
function educationBelongsInMain(data: ResumeData): boolean {
  return data.education.some((edu) => {
    // Runtime-safe access: schema may add `description` later; in that case
    // we do want to trigger main-column placement.
    const desc = (edu as unknown as { description?: string | null }).description;
    return desc != null && desc.trim().length > 0;
  });
}

// ── Main component ──────────────────────────────────────────────────────────

export function ModernTemplate({ data, sectionsOrder }: TemplateComponentProps) {
  const info = data.personal_info;
  const nameText = info.name?.trim();
  const displayName = nameText || "Your Name";
  const nameStyle = nameText ? styles.name : styles.nameEmpty;

  const roleTitle = deriveRoleTitle(data);
  const eduInMain = educationBelongsInMain(data);

  // Resolve main-column section order. Filter to known keys then append any
  // defaults the caller omitted (so new sections appear by default when the
  // caller doesn't know about them).
  const baseOrder = sectionsOrder?.length ? sectionsOrder : DEFAULT_MAIN_ORDER;
  const mainOrder: string[] = [
    ...baseOrder.filter((s) => MAIN_COLUMN_SECTIONS.includes(s)),
    ...DEFAULT_MAIN_ORDER.filter((s) => !baseOrder.includes(s)),
  ];

  function renderMainSection(key: string, isFirst: boolean) {
    switch (key) {
      case "summary":
        return renderProfile(data, isFirst);
      case "experience":
        return renderExperience(data, isFirst);
      case "education":
        return eduInMain ? renderMainEducation(data, isFirst) : null;
      case "certifications":
        return renderCertifications(data, isFirst);
      default:
        return null;
    }
  }

  // Build sidebar section list, skipping empties entirely so the first
  // rendered section gets the "first" (no top-margin) heading style.
  const sidebarRendered: React.ReactNode[] = [];
  let sidebarFirstUsed = false;
  const sidebarBuilders: Array<() => React.ReactNode> = [
    () => renderContact(data, !sidebarFirstUsed),
  ];
  if (!eduInMain) {
    sidebarBuilders.push(() => renderSidebarEducation(data, !sidebarFirstUsed));
  }
  sidebarBuilders.push(() => renderSkills(data, !sidebarFirstUsed));

  for (const builder of sidebarBuilders) {
    const el = builder();
    if (el) {
      sidebarFirstUsed = true;
      sidebarRendered.push(el);
    }
  }

  // Build main column sections, also tracking first-heading to reset top
  // margin. Note: on page 1 the main column sits below the header band, so
  // the first section's top margin is already "enough" from the header
  // whitespace; we still use isFirst to avoid accidental double-spacing.
  const mainRendered: React.ReactNode[] = [];
  let mainFirstUsed = false;
  for (const key of mainOrder) {
    const el = renderMainSection(key, !mainFirstUsed);
    if (el) {
      mainFirstUsed = true;
      mainRendered.push(el);
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Dark sidebar background — `fixed` makes it paint on every page.
            Must come before flow content so it sits BEHIND everything. */}
        <View fixed style={styles.sidebarBackground} />

        {/* Header band — page 1 only. Not `fixed`, so it scrolls away on
            subsequent pages. Spans the full paper width including over the
            sidebar background (the fixed background is still visible below
            the header on page 1). */}
        <View style={styles.headerBand}>
          <View style={styles.headerNameBlock}>
            <Text style={nameStyle}>{displayName}</Text>
          </View>
          <View style={styles.headerDivider} />
          {roleTitle ? (
            <View style={styles.headerSubtitleBand}>
              <Text style={styles.roleTitle}>{roleTitle}</Text>
            </View>
          ) : null}
        </View>

        {/* Two-column body. flex:1 so it fills remaining page height and the
            columns line up with the fixed sidebar background on page 1. */}
        <View style={styles.body}>
          <View style={styles.sidebar}>
            {sidebarRendered.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>
          <View style={styles.main}>
            {mainRendered.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>
        </View>

        {/* Fixed page-number footer — only rendered when totalPages > 1.
            Right-aligned within the main column so it doesn't collide with
            the dark sidebar. */}
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
        />
      </Page>
    </Document>
  );
}
