import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { TemplateComponentProps } from "../types";
import type { ResumeData } from "@/types/resume";
// Side-effect import registers Inter (weights 400/500/600/700, latin-ext +
// cyrillic) via Font.register. Also disables hyphenation. Must be imported
// before any Page render — the Document below uses fontFamily: "Inter" and
// will silently fall back to Helvetica if the registration hasn't run.
import "../fonts";

// ── Section ordering ─────────────────────────────────────────────────────────
// Main column renders in this order; sidebar order is fixed (Contact → Skills
// → Languages → Certifications). ResumeData has no Projects field today, so
// the spec's "Projects" slot is intentionally omitted — do NOT add a field.
const MAIN_COLUMN_SECTIONS = ["summary", "experience", "education"];
const DEFAULT_MAIN_ORDER = ["summary", "experience", "education"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPdfLinkLabel(
  url: string | null
): { label: string; href: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com")) return { label: "linkedin.com", href };
  if (clean.startsWith("github.com")) return { label: "github.com", href };
  const hostname = clean.split("/")[0];
  return { label: hostname, href };
}

// Role subtitle: ResumeData has no explicit role field, so derive from the
// most recent experience title. Returns null if nothing usable — caller omits
// the subtitle entirely in that case.
function deriveRoleTitle(data: ResumeData): string | null {
  const first = data.experience?.[0];
  const title = first?.title?.trim();
  return title ? title : null;
}

// U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK — the signature modern
// bullet. Inline const so reviewers see the intent without hunting the spec.
const BULLET_CHAR = "\u203A";

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
      {info.email ? (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Email</Text>
          <Text style={styles.contactValue}>{info.email}</Text>
        </View>
      ) : null}
      {info.phone ? (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Phone</Text>
          <Text style={styles.contactValue}>{info.phone}</Text>
        </View>
      ) : null}
      {info.location ? (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Location</Text>
          <Text style={styles.contactValue}>{info.location}</Text>
        </View>
      ) : null}
      {linkedinLink ? (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>LinkedIn</Text>
          <Link src={linkedinLink.href} style={styles.contactLink}>
            {linkedinLink.label}
          </Link>
        </View>
      ) : null}
      {websiteLink ? (
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Website</Text>
          <Link src={websiteLink.href} style={styles.contactLink}>
            {websiteLink.label}
          </Link>
        </View>
      ) : null}
    </View>
  );
}

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
      <View style={styles.skillsContainer}>
        {data.skills.map((skill, i) => (
          // Each skill is an individual pill View, not concatenated text —
          // this is the signature visual element per the spec.
          <Text key={i} style={styles.skillPill}>
            {skill}
          </Text>
        ))}
      </View>
    </View>
  );
}

function renderLanguages(data: ResumeData, isFirst: boolean) {
  if (!data.languages.length) return null;
  return (
    <View key="languages">
      <Text
        style={
          isFirst ? styles.sidebarSectionTitleFirst : styles.sidebarSectionTitle
        }
      >
        Languages
      </Text>
      <Text style={styles.sidebarBody}>{data.languages.join(", ")}</Text>
    </View>
  );
}

function renderCertifications(data: ResumeData, isFirst: boolean) {
  if (!data.certifications.length) return null;
  return (
    <View key="certifications">
      <Text
        style={
          isFirst ? styles.sidebarSectionTitleFirst : styles.sidebarSectionTitle
        }
      >
        Certifications
      </Text>
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

// ── Main column renderers ────────────────────────────────────────────────────

function renderSummary(data: ResumeData, isFirst: boolean) {
  if (!data.summary?.trim()) return null;
  // Orphan control (BF-1.4): keep section title bound to its first content
  // block so the heading can't land alone at the bottom of a page. Summary
  // has only one block, so the whole section stays together.
  return (
    <View key="summary" wrap={false} minPresenceAhead={40}>
      <Text
        style={
          isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle
        }
      >
        Summary
      </Text>
      <Text style={styles.summaryText}>{data.summary}</Text>
    </View>
  );
}

function renderExperienceItem(
  exp: ResumeData["experience"][number],
  key: number,
) {
  const endLabel = exp.current ? "Present" : exp.end_date;
  const dateParts = [exp.start_date, endLabel].filter(Boolean);
  const dateLabel = dateParts.join(" \u2013 ");
  return (
    <View key={key} style={styles.experienceItem} wrap={false}>
      {/* Title + dates on one row: title left, dates right-aligned. */}
      <View style={styles.experienceHeaderRow}>
        <Text style={styles.experienceTitle}>{exp.title}</Text>
        {dateLabel ? (
          <Text style={styles.experienceDates}>{dateLabel}</Text>
        ) : null}
      </View>
      {exp.company ? (
        <Text style={styles.experienceCompany}>{exp.company}</Text>
      ) : null}
      {exp.description?.trim() ? (
        <Text style={styles.experienceDescription}>{exp.description}</Text>
      ) : null}
      {(exp.achievements ?? []).length > 0 && (
        <View style={styles.achievementsContainer}>
          {exp.achievements.map((ach, j) => (
            <View key={j} style={styles.achievementRow}>
              <Text style={styles.achievementBullet}>{BULLET_CHAR}</Text>
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
  // Orphan control (BF-1.4, BF-1.6): only the (section title + first entry)
  // is wrap={false}-bound. Subsequent entries break freely so tall sections
  // don't push themselves to the next page and leave a near-empty page.
  return (
    <View key="experience">
      <View wrap={false} minPresenceAhead={40}>
        <Text
          style={
            isFirst ? styles.mainSectionTitleFirst : styles.mainSectionTitle
          }
        >
          Experience
        </Text>
        {renderExperienceItem(first, 0)}
      </View>
      {rest.map((exp, i) => renderExperienceItem(exp, i + 1))}
    </View>
  );
}

function renderEducationItem(
  edu: ResumeData["education"][number],
  key: number,
) {
  const dateParts = [edu.start_date, edu.end_date].filter(Boolean);
  const dateLabel = dateParts.join(" \u2013 ");
  const degreeParts = [edu.degree, edu.field].filter(Boolean);
  return (
    <View key={key} style={styles.educationItem} wrap={false}>
      <View style={styles.educationHeaderRow}>
        <Text style={styles.educationInstitution}>{edu.institution}</Text>
        {dateLabel ? (
          <Text style={styles.educationDates}>{dateLabel}</Text>
        ) : null}
      </View>
      {degreeParts.length > 0 && (
        <Text style={styles.educationDegree}>
          {degreeParts.join(", ")}
          {edu.gpa ? ` \u00b7 GPA: ${edu.gpa}` : ""}
        </Text>
      )}
    </View>
  );
}

function renderEducation(data: ResumeData, isFirst: boolean) {
  if (!data.education.length) return null;
  const [first, ...rest] = data.education;
  // BF-1.6: previous version applied wrap={false} to the whole section which
  // forced the entire Education block to move to a fresh page when it didn't
  // fit, leaving a near-empty tail page. Now only (title + first entry) is
  // bound; later entries break freely across pages.
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
        {renderEducationItem(first, 0)}
      </View>
      {rest.map((edu, i) => renderEducationItem(edu, i + 1))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModernTemplate({ data, sectionsOrder }: TemplateComponentProps) {
  const info = data.personal_info;
  const nameText = info.name?.trim();
  const displayName = nameText || "Your Name";
  // Placeholder styling is carried over from Phase 1 but re-tuned to the new
  // palette (slate-300) — a flat hex on Phase 1's indigo banner looked muted
  // against the new white main column.
  const nameStyle = nameText ? styles.name : styles.nameEmpty;

  const roleTitle = deriveRoleTitle(data);

  // Resolve main-column section order. Start from caller-provided order,
  // filter to main-column keys, then append any defaults the caller omitted
  // so new sections appear by default when the schema grows.
  const baseOrder = sectionsOrder?.length ? sectionsOrder : DEFAULT_MAIN_ORDER;
  const mainOrder: string[] = [
    ...baseOrder.filter((s) => MAIN_COLUMN_SECTIONS.includes(s)),
    ...DEFAULT_MAIN_ORDER.filter((s) => !baseOrder.includes(s)),
  ];

  function renderMainSection(key: string, isFirst: boolean) {
    switch (key) {
      case "summary":
        return renderSummary(data, isFirst);
      case "experience":
        return renderExperience(data, isFirst);
      case "education":
        return renderEducation(data, isFirst);
      default:
        return null;
    }
  }

  // Build sidebar section list, skipping empties entirely so the first
  // rendered one gets the "first" (no top-margin) heading style.
  const sidebarRendered: React.ReactNode[] = [];
  let sidebarFirstUsed = false;
  for (const builder of [
    () => renderContact(data, !sidebarFirstUsed),
    () => renderSkills(data, !sidebarFirstUsed),
    () => renderLanguages(data, !sidebarFirstUsed),
    () => renderCertifications(data, !sidebarFirstUsed),
  ]) {
    const el = builder();
    if (el) {
      sidebarFirstUsed = true;
      sidebarRendered.push(el);
    }
  }

  // Same first-heading-margin-reset pattern for the main column. The name
  // block already provides visible hierarchy, so the first section title
  // keeps its normal 18pt top margin by always passing isFirst=false for
  // main sections — but we still use the "First" style to avoid accidental
  // double-spacing when the name block's own margin is tight. Empirically,
  // the spec calls for "no underline, no divider" and the name block has
  // marginBottom:20, so a zero-top-margin first heading reads clean.
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
        <View style={styles.columnsContainer}>
          {/* Left sidebar — lavender-gray background + indigo accent bar */}
          <View style={styles.sidebar}>
            <View style={styles.sidebarAccent} />
            {sidebarRendered.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>

          {/* Right main column — name block, then ordered sections */}
          <View style={styles.main}>
            <View style={styles.nameBlock}>
              <Text style={nameStyle}>{displayName}</Text>
              {roleTitle ? (
                <Text style={styles.roleTitle}>{roleTitle}</Text>
              ) : null}
            </View>
            {mainRendered.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>
        </View>

        {/* Fixed page-number footer — only shown on multi-page resumes. The
            `fixed` attribute + absolute positioning keep it out of the
            content flow. Carried over from Phase 1, restyled to the new
            palette (8pt, Inter 400, slate-500). */}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
        />
      </Page>
    </Document>
  );
}
