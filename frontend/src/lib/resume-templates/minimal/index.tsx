// Minimal resume template — editorial redesign (RTV-3.1).
//
// Concept: typography-first, grid-driven, single column. Looks like a page
// from a well-made annual report (Apple, MIT Tech Review, Stripe Press).
//
// Signature elements:
//   - Fraunces serif for the name and section titles (sentence case).
//   - Inter sans for body, dates, contact.
//   - One 1pt hairline rule, under the header. No other rules anywhere.
//   - Generous margins (64pt top/bottom, 72pt left/right).
//   - Em-dash bullets in neutral-400.
//   - Labeled grouped-line for skills/languages instead of a comma-run.
//
// Orphan control from RTV-1.4 is preserved: every section wraps its heading
// and first item in <View wrap={false} minPresenceAhead={40}>.

import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { styles } from "./styles";
import "../fonts"; // side-effect: registers Fraunces + Inter
import { isCyrillic } from "../fonts";
import type { TemplateComponentProps } from "../types";
import type { ResumeData } from "@/types/resume";

const DEFAULT_ORDER = [
  "personal_info",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPdfLinkLabel(
  url: string | null,
): { label: string; href: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com")) return { label: "LinkedIn", href };
  if (clean.startsWith("github.com")) return { label: "GitHub", href };
  if (clean.startsWith("behance.net")) return { label: "Behance", href };
  if (clean.startsWith("dribbble.com")) return { label: "Dribbble", href };
  const hostname = clean.split("/")[0];
  return { label: hostname, href };
}

// Real middle-dot character (U+00B7) for the contact separator — carries over
// the RTV-1.3 fix. Declared as a JS constant so it cannot be accidentally
// introduced as JSX text content (which renders the literal escape sequence).
const DOT = "\u00B7";
const EM_DASH = "\u2014";

// ── Section renderers ────────────────────────────────────────────────────────

function renderPersonalInfo(data: ResumeData) {
  const info = data.personal_info;
  const basicParts = [info.email, info.phone, info.location].filter(
    Boolean,
  ) as string[];
  const linkedinLink = getPdfLinkLabel(info.linkedin);
  const websiteLink = getPdfLinkLabel(info.website);
  const hasContact = basicParts.length > 0 || linkedinLink || websiteLink;

  const contactParts: Array<
    | { type: "text"; value: string }
    | { type: "link"; label: string; href: string }
  > = [];
  basicParts.forEach((part) => {
    contactParts.push({ type: "text", value: part });
  });
  if (linkedinLink)
    contactParts.push({
      type: "link",
      label: linkedinLink.label,
      href: linkedinLink.href,
    });
  if (websiteLink)
    contactParts.push({
      type: "link",
      label: websiteLink.label,
      href: websiteLink.href,
    });

  const nameText = info.name?.trim();
  const displayName = nameText || "Your Name";

  // Fraunces lacks a Cyrillic subset on fontsource, so fall back to Inter 600
  // at the same display size when the name contains Cyrillic. Documented
  // trade-off per RTV-3.1 acceptance criteria.
  const useSerifForName = !isCyrillic(displayName);
  const nameStyleBase = useSerifForName
    ? styles.headerName
    : styles.headerNameCyrillic;
  const nameStyle = nameText
    ? nameStyleBase
    : [nameStyleBase, styles.headerNamePlaceholder];

  // Role title: derived from first experience entry (no explicit role field
  // exists in ResumeData and adding one is out of scope).
  const derivedRole = data.experience[0]?.title?.trim() || null;

  return (
    <View style={styles.headerSection} key="personal_info">
      <Text style={nameStyle}>{displayName}</Text>
      {derivedRole ? <Text style={styles.headerRole}>{derivedRole}</Text> : null}
      {hasContact && (
        <View style={styles.headerContact}>
          {contactParts.map((part, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              {i > 0 && (
                <Text style={styles.headerContactText}>{` ${DOT} `}</Text>
              )}
              {part.type === "text" ? (
                <Text style={styles.headerContactText}>{part.value}</Text>
              ) : (
                <Link src={part.href} style={styles.headerContactLink}>
                  {part.label}
                </Link>
              )}
            </View>
          ))}
        </View>
      )}
      {/* THE single hairline rule on the page. No other borders anywhere. */}
      <View style={styles.headerDivider} />
    </View>
  );
}

function renderSummary(data: ResumeData) {
  if (!data.summary) return null;
  return (
    <View
      style={styles.sectionContainer}
      key="summary"
      wrap={false}
      minPresenceAhead={40}
    >
      <Text style={styles.sectionHeading}>Summary</Text>
      <Text style={styles.summaryText}>{data.summary}</Text>
    </View>
  );
}

function renderExperienceItem(
  exp: ResumeData["experience"][number],
  key: number,
) {
  const dateParts = [
    exp.start_date,
    exp.current ? "Present" : exp.end_date,
  ].filter(Boolean);
  const hasTitle = !!exp.title;
  const hasCompany = !!exp.company;

  return (
    <View key={key} style={styles.experienceItem} wrap={false}>
      <View style={styles.experienceHeader}>
        {/* Title + em-dash + company on a single Text run so they wrap together
            and share the baseline with the right-aligned date. */}
        <Text style={styles.experienceTitleLine}>
          {hasTitle && <Text style={styles.experienceTitle}>{exp.title}</Text>}
          {hasTitle && hasCompany && (
            <Text style={styles.experienceSeparator}>{` ${EM_DASH} `}</Text>
          )}
          {hasCompany && (
            <Text style={styles.experienceCompany}>{exp.company}</Text>
          )}
        </Text>
        {dateParts.length > 0 && (
          <Text style={styles.experienceDates}>
            {dateParts.join(` ${EM_DASH} `)}
          </Text>
        )}
      </View>
      {exp.description ? (
        <Text style={styles.experienceDescription}>{exp.description}</Text>
      ) : null}
      {(exp.achievements ?? []).length > 0 && (
        <View style={styles.achievementsList}>
          {exp.achievements.map((ach, j) => (
            <View key={j} style={styles.achievementRow}>
              <Text style={styles.achievementBullet}>{EM_DASH}</Text>
              <Text style={styles.achievementText}>{ach}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function renderExperience(data: ResumeData) {
  if (!data.experience.length) return null;
  const [first, ...rest] = data.experience;
  return (
    <View style={styles.sectionContainer} key="experience">
      {/* Keep heading + first item together across page breaks */}
      <View wrap={false} minPresenceAhead={40}>
        <Text style={styles.sectionHeading}>Experience</Text>
        <View style={styles.experienceList}>
          {renderExperienceItem(first, 0)}
        </View>
      </View>
      {rest.length > 0 && (
        <View style={[styles.experienceList, { marginTop: 14 }]}>
          {rest.map((exp, i) => renderExperienceItem(exp, i + 1))}
        </View>
      )}
    </View>
  );
}

function renderEducationItem(
  edu: ResumeData["education"][number],
  key: number,
) {
  const dateParts = [edu.start_date, edu.end_date].filter(Boolean);
  const degreeParts = [edu.degree, edu.field].filter(Boolean);
  return (
    <View key={key} style={styles.educationItem} wrap={false}>
      <View style={styles.educationHeader}>
        <Text style={styles.educationInstitution}>{edu.institution}</Text>
        {dateParts.length > 0 && (
          <Text style={styles.educationDates}>
            {dateParts.join(` ${EM_DASH} `)}
          </Text>
        )}
      </View>
      <Text style={styles.educationDegree}>
        {degreeParts.join(", ")}
        {edu.gpa ? ` ${DOT} GPA: ${edu.gpa}` : ""}
      </Text>
    </View>
  );
}

function renderEducation(data: ResumeData) {
  if (!data.education.length) return null;
  const [first, ...rest] = data.education;
  return (
    <View style={styles.sectionContainer} key="education">
      <View wrap={false} minPresenceAhead={40}>
        <Text style={styles.sectionHeading}>Education</Text>
        <View style={styles.educationList}>
          {renderEducationItem(first, 0)}
        </View>
      </View>
      {rest.length > 0 && (
        <View style={[styles.educationList, { marginTop: 10 }]}>
          {rest.map((edu, i) => renderEducationItem(edu, i + 1))}
        </View>
      )}
    </View>
  );
}

// Grouped-label line renderer used by Skills and Languages.
// Spec asks for grouped/labeled lines like "Languages — JavaScript, …". The
// current ResumeData shape has `skills: string[]` and `languages: string[]`
// as flat arrays — there is no category metadata available, and adding it
// is explicitly out of scope for RTV-3.1. The fallback (documented here) is
// to render the section label ("Skills"/"Languages") as the group label
// followed by an em-dash and the joined values. This still reads as editorial
// because the bolder label + em-dash creates visual hierarchy vs. a bare
// comma-run. If the data model ever gains groups (e.g. "Languages:
// [{label, items}]"), this renderer would iterate them instead.
function renderLabeledLine(label: string, values: string[]) {
  return (
    <View style={styles.labeledLine}>
      <Text style={styles.labeledValue}>
        <Text style={styles.labeledLabel}>{label}</Text>
        <Text style={styles.labeledDash}>{` ${EM_DASH} `}</Text>
        {values.join(", ")}
      </Text>
    </View>
  );
}

function renderSkills(data: ResumeData) {
  if (!data.skills.length) return null;
  return (
    <View
      style={styles.sectionContainer}
      key="skills"
      wrap={false}
      minPresenceAhead={40}
    >
      <Text style={styles.sectionHeading}>Skills</Text>
      {renderLabeledLine("Skills", data.skills)}
    </View>
  );
}

function renderLanguages(data: ResumeData) {
  if (!data.languages.length) return null;
  return (
    <View
      style={styles.sectionContainer}
      key="languages"
      wrap={false}
      minPresenceAhead={40}
    >
      <Text style={styles.sectionHeading}>Languages</Text>
      {renderLabeledLine("Languages", data.languages)}
    </View>
  );
}

function renderCertificationItem(
  cert: ResumeData["certifications"][number],
  key: number,
) {
  const metaParts = [cert.issuer, cert.date].filter(Boolean);
  return (
    <View key={key} style={styles.certificationItem} wrap={false}>
      <Text style={styles.certificationName}>{cert.name}</Text>
      {metaParts.length > 0 && (
        <Text style={styles.certificationMeta}>
          {metaParts.join(` ${DOT} `)}
        </Text>
      )}
    </View>
  );
}

function renderCertifications(data: ResumeData) {
  if (!data.certifications.length) return null;
  const [first, ...rest] = data.certifications;
  return (
    <View style={styles.sectionContainer} key="certifications">
      <View wrap={false} minPresenceAhead={40}>
        <Text style={styles.sectionHeading}>Certifications</Text>
        {renderCertificationItem(first, 0)}
      </View>
      {rest.map((cert, i) => renderCertificationItem(cert, i + 1))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MinimalTemplate({
  data,
  sectionsOrder,
}: TemplateComponentProps) {
  const order = sectionsOrder?.length ? sectionsOrder : DEFAULT_ORDER;

  function renderSection(key: string) {
    switch (key) {
      case "personal_info":
        return renderPersonalInfo(data);
      case "summary":
        return renderSummary(data);
      case "experience":
        return renderExperience(data);
      case "education":
        return renderEducation(data);
      case "skills":
        return renderSkills(data);
      case "languages":
        return renderLanguages(data);
      case "certifications":
        return renderCertifications(data);
      default:
        return null;
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {order.map((key) => {
          const section = renderSection(key);
          if (!section) return null;
          return <View key={key}>{section}</View>;
        })}
        {/* Page number — empty string on page 1, '— N —' in Fraunces italic
            on subsequent pages. `fixed` keeps it out of content flow so it
            doesn't affect pagination or bleed into the body. */}
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber }) =>
            pageNumber > 1 ? `${EM_DASH} ${pageNumber} ${EM_DASH}` : ""
          }
        />
      </Page>
    </Document>
  );
}
