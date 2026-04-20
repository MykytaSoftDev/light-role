import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { TemplateComponentProps } from "../types";
import type { ResumeData } from "@/types/resume";

// Sections that belong in the right column
const RIGHT_COLUMN_SECTIONS = ["summary", "experience", "education"];
const DEFAULT_RIGHT_ORDER = ["summary", "experience", "education"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPdfLinkLabel(url: string | null): { label: string; href: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com")) return { label: "linkedin.com", href };
  if (clean.startsWith("github.com")) return { label: "github.com", href };
  // Use hostname as label for other URLs
  const hostname = clean.split("/")[0];
  return { label: hostname, href };
}

// ── Left column renderers ─────────────────────────────────────────────────────

function renderContact(data: ResumeData, isFirst: boolean) {
  const info = data.personal_info;
  const hasAny =
    info.email || info.phone || info.location || info.linkedin || info.website;
  if (!hasAny) return null;

  const linkedinLink = getPdfLinkLabel(info.linkedin);
  const websiteLink = getPdfLinkLabel(info.website);

  return (
    <View key="contact">
      <Text style={isFirst ? styles.leftSectionHeadingFirst : styles.leftSectionHeading}>
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

function renderSkillsLeft(data: ResumeData) {
  if (!data.skills.length) return null;
  return (
    <View key="skills">
      <Text style={styles.leftSectionHeading}>Skills</Text>
      <View style={styles.skillsContainer}>
        {data.skills.map((skill, i) => (
          <Text key={i} style={styles.skillTag}>
            {skill}
            {i < data.skills.length - 1 ? " \u00b7" : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

function renderLanguagesLeft(data: ResumeData) {
  if (!data.languages.length) return null;
  return (
    <View key="languages">
      <Text style={styles.leftSectionHeading}>Languages</Text>
      <Text style={styles.leftBodyText}>{data.languages.join(", ")}</Text>
    </View>
  );
}

function renderCertificationsLeft(data: ResumeData) {
  if (!data.certifications.length) return null;
  return (
    <View key="certifications">
      <Text style={styles.leftSectionHeading}>Certifications</Text>
      {data.certifications.map((cert, i) => {
        const metaParts = [cert.issuer, cert.date].filter(Boolean);
        return (
          <View key={i} style={styles.certificationItem}>
            <Text style={styles.certificationName}>{cert.name}</Text>
            {metaParts.length > 0 && (
              <Text style={styles.certificationMeta}>{metaParts.join(" \u00b7 ")}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Right column renderers ────────────────────────────────────────────────────

function renderSummary(data: ResumeData, isFirst: boolean) {
  if (!data.summary?.trim()) return null;
  return (
    <View key="summary">
      <Text style={isFirst ? styles.rightSectionHeadingFirst : styles.rightSectionHeading}>
        Summary
      </Text>
      <Text style={styles.summaryText}>{data.summary}</Text>
    </View>
  );
}

function renderExperience(data: ResumeData, isFirst: boolean) {
  if (!data.experience.length) return null;
  return (
    <View key="experience">
      <Text style={isFirst ? styles.rightSectionHeadingFirst : styles.rightSectionHeading}>
        Experience
      </Text>
      <View style={styles.experienceList}>
        {data.experience.map((exp, i) => {
          const endLabel = exp.current ? "Present" : exp.end_date;
          const dateParts = [exp.start_date, endLabel].filter(Boolean);
          return (
            <View key={i} style={styles.experienceItem} wrap={false}>
              <Text style={styles.experienceTitle}>{exp.title}</Text>
              <View style={styles.experienceCompanyRow}>
                <Text style={styles.experienceCompany}>{exp.company}</Text>
                {dateParts.length > 0 && (
                  <Text style={styles.experienceDates}>{dateParts.join(" \u2013 ")}</Text>
                )}
              </View>
              {exp.description?.trim() ? (
                <Text style={styles.experienceDescription}>{exp.description}</Text>
              ) : null}
              {(exp.achievements ?? []).length > 0 && (
                <View>
                  {exp.achievements.map((ach, j) => (
                    <View key={j} style={styles.achievementRow}>
                      <Text style={styles.achievementBullet}>{"\u2022"}</Text>
                      <Text style={styles.achievementText}>{ach}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function renderEducation(data: ResumeData, isFirst: boolean) {
  if (!data.education.length) return null;
  return (
    <View key="education">
      <Text style={isFirst ? styles.rightSectionHeadingFirst : styles.rightSectionHeading}>
        Education
      </Text>
      <View style={styles.educationList}>
        {data.education.map((edu, i) => {
          const dateParts = [edu.start_date, edu.end_date].filter(Boolean);
          const degreeParts = [edu.degree, edu.field].filter(Boolean);
          return (
            <View key={i} style={styles.educationItem} wrap={false}>
              <Text style={styles.educationInstitution}>{edu.institution}</Text>
              {dateParts.length > 0 && (
                <Text style={styles.educationDates}>{dateParts.join(" \u2013 ")}</Text>
              )}
              {degreeParts.length > 0 && (
                <Text style={styles.educationDegree}>
                  {degreeParts.join(", ")}
                  {edu.gpa ? ` \u00b7 GPA: ${edu.gpa}` : ""}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModernTemplate({ data, sectionsOrder, name }: TemplateComponentProps) {
  const info = data.personal_info;
  const displayName = name || info.name || "Your Name";

  // Determine right column order: filter sectionsOrder to only right-column sections,
  // then append any right-column sections not mentioned in sectionsOrder
  const baseOrder = sectionsOrder?.length ? sectionsOrder : DEFAULT_RIGHT_ORDER;
  const rightOrder: string[] = [
    ...baseOrder.filter((s) => RIGHT_COLUMN_SECTIONS.includes(s)),
    ...DEFAULT_RIGHT_ORDER.filter(
      (s) => !baseOrder.includes(s)
    ),
  ];

  function renderRightSection(key: string, isFirst: boolean) {
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

  // Left column: Contact is always first
  const hasContact =
    info.email || info.phone || info.location || info.linkedin || info.website;

  const leftSections = [
    hasContact ? renderContact(data, true) : null,
    renderSkillsLeft(data),
    renderLanguagesLeft(data),
    renderCertificationsLeft(data),
  ].filter(Boolean);

  // Track which right sections actually render (for first-heading margin reset)
  const rightRendered: ReturnType<typeof renderSummary>[] = [];
  let rightFirstUsed = false;
  for (const key of rightOrder) {
    const el = renderRightSection(key, !rightFirstUsed);
    if (el) {
      rightFirstUsed = true;
      rightRendered.push(el);
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Full-width indigo header */}
        <View style={styles.header}>
          <Text style={styles.headerName}>{displayName}</Text>
        </View>

        {/* Two-column body */}
        <View style={styles.columnsContainer}>
          {/* Left sidebar */}
          <View style={styles.leftColumn}>
            {leftSections.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>

          {/* Right main content */}
          <View style={styles.rightColumn}>
            {rightRendered.map((section, i) => (
              <View key={i}>{section}</View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
