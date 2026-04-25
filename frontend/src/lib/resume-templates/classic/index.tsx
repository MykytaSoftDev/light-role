import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { TemplateComponentProps } from "../types";
import type { ResumeData } from "@/types/resume";

const DEFAULT_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPdfLinkLabel(url: string | null): { label: string; href: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com")) return { label: "LinkedIn", href };
  if (clean.startsWith("github.com")) return { label: "GitHub", href };
  if (clean.startsWith("behance.net")) return { label: "Behance", href };
  if (clean.startsWith("dribbble.com")) return { label: "Dribbble", href };
  // Use hostname portion as label for other websites
  const hostname = clean.split("/")[0];
  return { label: hostname, href };
}

// ── Section renderers ────────────────────────────────────────────────────────

function renderPersonalInfo(data: ResumeData) {
  const info = data.personal_info;
  const basicParts = [info.email, info.phone, info.location].filter(Boolean) as string[];
  const linkedinLink = getPdfLinkLabel(info.linkedin);
  const websiteLink = getPdfLinkLabel(info.website);
  const hasContact = basicParts.length > 0 || linkedinLink || websiteLink;

  // Build contact parts array for rendering with separators
  const contactParts: Array<{ type: "text"; value: string } | { type: "link"; label: string; href: string }> = [];
  basicParts.forEach((part) => {
    contactParts.push({ type: "text", value: part });
  });
  if (linkedinLink) contactParts.push({ type: "link", label: linkedinLink.label, href: linkedinLink.href });
  if (websiteLink) contactParts.push({ type: "link", label: websiteLink.label, href: websiteLink.href });

  const nameText = info.name?.trim();
  const displayName = nameText || "Your Name";
  const nameStyle = nameText ? styles.headerName : [styles.headerName, { color: "#9CA3AF" }];

  return (
    <View style={styles.headerSection} key="personal_info">
      <Text style={nameStyle}>{displayName}</Text>
      {hasContact && (
        <View style={styles.headerContact}>
          {contactParts.map((part, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              {i > 0 && <Text style={styles.headerContactText}>{" \u00b7 "}</Text>}
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
    </View>
  );
}

function renderSummary(data: ResumeData) {
  if (!data.summary) return null;
  return (
    <View style={styles.sectionContainer} key="summary">
      <Text style={styles.sectionHeading}>Summary</Text>
      <Text style={styles.summaryText}>{data.summary}</Text>
    </View>
  );
}

function renderExperience(data: ResumeData) {
  if (!data.experience.length) return null;
  return (
    <View style={styles.sectionContainer} key="experience">
      <Text style={styles.sectionHeading}>Experience</Text>
      <View style={styles.experienceList}>
        {data.experience.map((exp, i) => {
          const dateParts = [exp.start_date, exp.current ? "Present" : exp.end_date].filter(Boolean);
          return (
            <View key={i} style={styles.experienceItem} wrap={false}>
              <View style={styles.experienceHeader}>
                <Text style={styles.experienceTitle}>
                  {exp.title}{exp.company ? ` \u2014 ${exp.company}` : ""}
                </Text>
                {dateParts.length > 0 && (
                  <Text style={styles.experienceDates}>{dateParts.join(" \u2013 ")}</Text>
                )}
              </View>
              {exp.description ? (
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

function renderEducation(data: ResumeData) {
  if (!data.education.length) return null;
  return (
    <View style={styles.sectionContainer} key="education">
      <Text style={styles.sectionHeading}>Education</Text>
      <View style={styles.educationList}>
        {data.education.map((edu, i) => {
          const dateParts = [edu.start_date, edu.end_date].filter(Boolean);
          const degreeParts = [edu.degree, edu.field].filter(Boolean);
          return (
            <View key={i} style={styles.educationItem} wrap={false}>
              <View style={styles.educationHeader}>
                <Text style={styles.educationInstitution}>{edu.institution}</Text>
                {dateParts.length > 0 && (
                  <Text style={styles.educationDates}>{dateParts.join(" \u2013 ")}</Text>
                )}
              </View>
              <Text style={styles.educationDegree}>
                {degreeParts.join(", ")}
                {edu.gpa ? ` \u00b7 GPA: ${edu.gpa}` : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function renderSkills(data: ResumeData) {
  if (!data.skills.length) return null;
  return (
    <View style={styles.sectionContainer} key="skills">
      <Text style={styles.sectionHeading}>Skills</Text>
      <Text style={styles.bodyText}>{data.skills.join(", ")}</Text>
    </View>
  );
}

function renderLanguages(data: ResumeData) {
  if (!data.languages.length) return null;
  return (
    <View style={styles.sectionContainer} key="languages">
      <Text style={styles.sectionHeading}>Languages</Text>
      <Text style={styles.bodyText}>{data.languages.join(", ")}</Text>
    </View>
  );
}

function renderCertifications(data: ResumeData) {
  if (!data.certifications.length) return null;
  return (
    <View style={styles.sectionContainer} key="certifications">
      <Text style={styles.sectionHeading}>Certifications</Text>
      {data.certifications.map((cert, i) => {
        const metaParts = [cert.issuer, cert.date].filter(Boolean);
        return (
          <View key={i} style={styles.certificationRow}>
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

// ── Main component ────────────────────────────────────────────────────────────

export function ClassicTemplate({ data, sectionsOrder }: TemplateComponentProps) {
  // Defensive: drop any stray "personal_info" entry from sectionsOrder.
  // The header is rendered unconditionally as the first block below, so
  // letting "personal_info" slip into the loop would render it twice. This
  // protects against persisted rows that bypass the editor's self-heal or
  // any other call site that includes the legacy key.
  const order = (sectionsOrder?.length ? sectionsOrder : DEFAULT_ORDER).filter(
    (k) => k !== "personal_info",
  );

  function renderSection(key: string) {
    switch (key) {
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
        {/* Header is pinned, always-first, never draggable. */}
        <View key="personal_info">{renderPersonalInfo(data)}</View>
        {order.map((key) => {
          const section = renderSection(key);
          if (!section) return null;
          return <View key={key}>{section}</View>;
        })}
      </Page>
    </Document>
  );
}
