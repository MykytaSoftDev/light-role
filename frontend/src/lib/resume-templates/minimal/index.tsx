// Minimal resume template — structured professional redesign (VO-2.1).
//
// Signature elements:
//   - Two-column layout: 160pt sidebar + 24pt gap + flex-1 main column.
//     NO visual divider between columns — whitespace only.
//   - Full-width header block (page 1 only): heavy uppercase Inter 800 name,
//     uppercase letter-spaced role, 1.5pt full-width rule.
//   - Vertical timeline in the main column: 1pt #CBD5E1 line running through
//     the center of each 26pt filled-navy circular section icon.
//   - 12pt white SVG icons inside the circles (user / briefcase / grad-cap /
//     folder / award) — inline path data, no external icon libraries.
//   - Sidebar contact rows prefixed with 10pt SVG icons.
//   - Skills / Languages as BULLETED vertical lists, not comma-runs.
//   - Inter-only typography; Fraunces is deliberately dropped here.
//
// Multi-page behavior: header only on page 1. Timeline restarts at the top
// of each subsequent page's main column at the same x-position (13pt from
// the main column's left edge). Orphan control (wrap={false} +
// minPresenceAhead) is preserved per bugfix BF-1.4/1.6.

import React from "react";
import { Document, Page, View, Text, Link, Svg, Path } from "@react-pdf/renderer";
import {
  styles,
  SECTION_ICON_SIZE,
  SECTION_ICON_RADIUS,
  TIMELINE_X,
} from "./styles";
import "../fonts"; // side-effect: registers Inter
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

// Colors used by inline SVG icons. Sidebar icons use ink (#0F172A); main
// column section icons use white (#FFFFFF) because they sit inside a
// filled-navy circle.
const ICON_COLOR_INK = "#0F172A";
const ICON_COLOR_WHITE = "#FFFFFF";

// ── Link label helper ────────────────────────────────────────────────────────

function getPdfLinkLabel(
  url: string | null,
): { label: string; href: string } | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const href = url.startsWith("http") ? url : `https://${url}`;
  if (clean.startsWith("linkedin.com")) return { label: "LinkedIn", href };
  if (clean.startsWith("github.com")) return { label: "GitHub", href };
  const hostname = clean.split("/")[0];
  return { label: hostname, href };
}

// Role subtitle: ResumeData has no explicit role field, so derive from the
// most recent experience title. Returns null if nothing usable — caller
// omits the subtitle line in that case.
function deriveRoleTitle(data: ResumeData): string | null {
  const first = data.experience?.[0];
  const title = first?.title?.trim();
  return title ? title : null;
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────
//
// All icons drawn at a 24x24 viewBox and resized at the call site via the
// Svg width/height props. Sidebar variants use stroke for a lighter weight
// glyph; section-circle variants use fill for better legibility at 12pt
// inside a dark circle.

// Phone handset. Classic rotated-bottom-left shape.
function PhoneIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.05-.24 11.36 11.36 0 003.55.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.55 1 1 0 01-.24 1.05z"
        fill={color}
      />
    </Svg>
  );
}

// Envelope (email). Simple rectangle with diagonal triangle flap.
function EmailIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2.2v10.3h16V7.2l-8 5.6-8-5.6zm1.5-.2l6.5 4.55L18.5 7h-13z"
        fill={color}
      />
    </Svg>
  );
}

// Map pin (location).
function LocationIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7zm0 4.5A2.5 2.5 0 1012 11a2.5 2.5 0 000-4.5z"
        fill={color}
      />
    </Svg>
  );
}

// Globe (website / portfolio).
function GlobeIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.4 0 2.9 1.7 3.6 4.5H8.4C9.1 5.7 10.6 4 12 4zM4.3 13a8 8 0 010-2h2.3a21 21 0 000 2H4.3zm.8 2h2a13 13 0 001.1 3.4A8 8 0 015.1 15zm2-6h-2a8 8 0 013-3.4A13 13 0 006.1 9zM8.4 15h7.2c-.7 2.8-2.2 4.5-3.6 4.5S9.1 17.8 8.4 15zm0-4h7.2a18 18 0 010 2H8.4a18 18 0 010-2zm9.5 4h2a8 8 0 01-3 3.4A13 13 0 0017.9 15zm2-6h-2a13 13 0 00-1.1-3.4A8 8 0 0119.9 9zM17.4 11h2.3a8 8 0 010 2h-2.3a21 21 0 000-2z"
        fill={color}
      />
    </Svg>
  );
}

// LinkedIn — lowercase 'in' in a small rounded square. Per spec: NOT the
// LinkedIn brand mark. Square outline + two letter shapes.
function LinkedInIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Rounded square outline */}
      <Path
        d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm0 2v14h14V5H5z"
        fill={color}
      />
      {/* 'i' — dot + stem */}
      <Path d="M7.5 8a1 1 0 110-2 1 1 0 010 2zm-.5 1.5h1v7h-1z" fill={color} />
      {/* 'n' — vertical stem + curved shoulder */}
      <Path
        d="M10.5 9.5h1v.9a2.3 2.3 0 012-1c1.3 0 2.2.9 2.2 2.4v4.7h-1v-4.4c0-1-.5-1.6-1.4-1.6-1 0-1.7.7-1.7 1.9v4.1h-1v-7z"
        fill={color}
      />
    </Svg>
  );
}

// GitHub — code brackets '< >' per spec. NOT the GitHub Octocat mark.
function GitHubIcon({ size = 10, color = ICON_COLOR_INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* '<' */}
      <Path
        d="M9.4 7.6l-5 4.4 5 4.4 1.2-1.4-3.4-3 3.4-3z"
        fill={color}
      />
      {/* '>' */}
      <Path
        d="M14.6 7.6l5 4.4-5 4.4-1.2-1.4 3.4-3-3.4-3z"
        fill={color}
      />
    </Svg>
  );
}

// ── Section icons (main column — 12pt white on dark circle) ────────────────

// User — head and shoulders outline (Profile / Summary).
function UserIcon({ size = 12, color = ICON_COLOR_WHITE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zm0-6a2 2 0 110 4 2 2 0 010-4zm-7 14c0-3.9 3.1-7 7-7s7 3.1 7 7v1H5v-1zm2 0h10c-.5-2.3-2.5-4-5-4s-4.5 1.7-5 4z"
        fill={color}
      />
    </Svg>
  );
}

// Briefcase — work experience.
function BriefcaseIcon({ size = 12, color = ICON_COLOR_WHITE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 4h6a2 2 0 012 2v2h4a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1h4V6a2 2 0 012-2zm0 4h6V6H9v2zM4 10v8h16v-8H4z"
        fill={color}
      />
    </Svg>
  );
}

// Graduation cap — education.
function GradCapIcon({ size = 12, color = ICON_COLOR_WHITE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3zm-6 10.2v3.3l6 3.3 6-3.3v-3.3l-6 3.3-6-3.3z"
        fill={color}
      />
    </Svg>
  );
}

// Folder — projects.
function FolderIcon({ size = 12, color = ICON_COLOR_WHITE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 5h6l2 2h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v12h16V9H10.2l-2-2H4z"
        fill={color}
      />
    </Svg>
  );
}

// Award / ribbon — certifications. Circle ribbon with tails below.
function AwardIcon({ size = 12, color = ICON_COLOR_WHITE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2a6 6 0 016 6 6 6 0 01-3 5.2V22l-3-2-3 2v-8.8A6 6 0 016 8a6 6 0 016-6zm0 2a4 4 0 100 8 4 4 0 000-8zm-2 11.5v3.6l2-1.3 2 1.3v-3.6a6 6 0 01-4 0z"
        fill={color}
      />
    </Svg>
  );
}

// Contact icon resolver. Maps field keys → icon component.
function renderContactIcon(kind: "phone" | "email" | "location" | "website" | "linkedin" | "github") {
  switch (kind) {
    case "phone":
      return <PhoneIcon />;
    case "email":
      return <EmailIcon />;
    case "location":
      return <LocationIcon />;
    case "website":
      return <GlobeIcon />;
    case "linkedin":
      return <LinkedInIcon />;
    case "github":
      return <GitHubIcon />;
  }
}

// Main-column section icon resolver. Returns the correct 12pt white SVG
// to render centered inside the 26pt navy circle.
function renderSectionIcon(section: string) {
  switch (section) {
    case "summary":
      return <UserIcon />;
    case "experience":
      return <BriefcaseIcon />;
    case "education":
      return <GradCapIcon />;
    case "projects":
      return <FolderIcon />;
    case "certifications":
      return <AwardIcon />;
    default:
      return null;
  }
}

// ── Sidebar renderers ────────────────────────────────────────────────────────

function SidebarSectionHeader({ title }: { title: string }) {
  return (
    <>
      <Text style={styles.sidebarSectionTitle}>{title}</Text>
      <View style={styles.sidebarSectionRule} />
    </>
  );
}

function renderContact(data: ResumeData) {
  const info = data.personal_info;
  const hasAny =
    info.email || info.phone || info.location || info.linkedin || info.website;
  if (!hasAny) return null;

  const linkedinLink = getPdfLinkLabel(info.linkedin);
  const websiteLink = getPdfLinkLabel(info.website);
  // Identify the domain for the website row to decide between a globe and
  // a github-brackets icon.
  const websiteKind: "website" | "github" =
    info.website && /github\.com/.test(info.website) ? "github" : "website";

  return (
    <View style={styles.sidebarSectionGroup} wrap={false}>
      <SidebarSectionHeader title="Contact" />
      {info.phone ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconWrap}>{renderContactIcon("phone")}</View>
          <Text style={styles.sidebarValue}>{info.phone}</Text>
        </View>
      ) : null}
      {info.email ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconWrap}>{renderContactIcon("email")}</View>
          <Text style={styles.sidebarValue}>{info.email}</Text>
        </View>
      ) : null}
      {info.location ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconWrap}>{renderContactIcon("location")}</View>
          <Text style={styles.sidebarValue}>{info.location}</Text>
        </View>
      ) : null}
      {linkedinLink ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconWrap}>{renderContactIcon("linkedin")}</View>
          <Link src={linkedinLink.href} style={styles.sidebarLink}>
            {linkedinLink.label}
          </Link>
        </View>
      ) : null}
      {websiteLink ? (
        <View style={styles.contactRow}>
          <View style={styles.contactIconWrap}>{renderContactIcon(websiteKind)}</View>
          <Link src={websiteLink.href} style={styles.sidebarLink}>
            {websiteLink.label}
          </Link>
        </View>
      ) : null}
    </View>
  );
}

function renderBulletedList(title: string, items: string[]) {
  if (!items.length) return null;
  return (
    <View style={styles.sidebarSectionGroup} wrap={false} minPresenceAhead={30}>
      <SidebarSectionHeader title={title} />
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>{"\u2022"}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function renderSidebarSkills(data: ResumeData) {
  return renderBulletedList("Skills", data.skills);
}

function renderSidebarLanguages(data: ResumeData) {
  return renderBulletedList("Languages", data.languages);
}

function renderSidebarCertifications(data: ResumeData) {
  if (!data.certifications.length) return null;
  return (
    <View style={styles.sidebarSectionGroup} wrap={false} minPresenceAhead={30}>
      <SidebarSectionHeader title="Certifications" />
      {data.certifications.map((cert, i) => {
        const metaParts = [cert.issuer, cert.date].filter(Boolean);
        return (
          <View key={i} style={styles.sidebarCertItem}>
            <Text style={styles.sidebarCertName}>{cert.name}</Text>
            {metaParts.length > 0 && (
              <Text style={styles.sidebarCertMeta}>{metaParts.join(" \u00b7 ")}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Main-column section shell ────────────────────────────────────────────────
//
// Every main-column section renders as a row with (icon-circle | title +
// body). The 26pt circle sits flush-left at x=0 of the main column; its
// center falls at x=13, which coincides with the timeline line.

function MainSection({
  section,
  title,
  children,
}: {
  section: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.mainSectionRow} wrap={false} minPresenceAhead={60}>
      <View style={styles.mainSectionIcon}>{renderSectionIcon(section)}</View>
      <View style={styles.mainSectionBody}>
        <Text style={styles.mainSectionTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

// For long sections (experience with many items) we don't want wrap={false}
// to force the whole thing onto the next page. This variant keeps only the
// (icon + title + first item) bound; subsequent items flow freely.
function MainSectionSplit({
  section,
  title,
  firstChild,
  restChildren,
}: {
  section: string;
  title: string;
  firstChild: React.ReactNode;
  restChildren: React.ReactNode[];
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.mainSectionRow} wrap={false} minPresenceAhead={80}>
        <View style={styles.mainSectionIcon}>{renderSectionIcon(section)}</View>
        <View style={styles.mainSectionBody}>
          <Text style={styles.mainSectionTitle}>{title}</Text>
          {firstChild}
        </View>
      </View>
      {restChildren.length > 0 && (
        // Subsequent items are rendered in a row that aligns with the body
        // column of the section header (26pt icon width + 12pt gap = 38pt
        // left offset).
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: SECTION_ICON_SIZE + 12, flexShrink: 0 }} />
          <View style={{ flex: 1 }}>{restChildren}</View>
        </View>
      )}
    </View>
  );
}

// ── Main-column section renderers ────────────────────────────────────────────

function renderSummary(data: ResumeData) {
  if (!data.summary?.trim()) return null;
  return (
    <MainSection section="summary" title="Profile">
      <Text style={styles.summaryText}>{data.summary}</Text>
    </MainSection>
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
      <View style={styles.experienceHeaderRow}>
        <Text style={styles.experienceTitle}>{exp.title}</Text>
        {dateLabel ? <Text style={styles.experienceDates}>{dateLabel}</Text> : null}
      </View>
      {exp.company ? <Text style={styles.experienceCompany}>{exp.company}</Text> : null}
      {exp.description?.trim() ? (
        <Text style={styles.experienceDescription}>{exp.description}</Text>
      ) : null}
      {(exp.achievements ?? []).length > 0 && (
        <View style={styles.achievementsContainer}>
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
}

function renderExperience(data: ResumeData) {
  if (!data.experience.length) return null;
  const [first, ...rest] = data.experience;
  return (
    <MainSectionSplit
      section="experience"
      title="Work Experience"
      firstChild={renderExperienceItem(first, 0)}
      restChildren={rest.map((exp, i) => renderExperienceItem(exp, i + 1))}
    />
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
        {dateLabel ? <Text style={styles.educationDates}>{dateLabel}</Text> : null}
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

function renderEducation(data: ResumeData) {
  if (!data.education.length) return null;
  const [first, ...rest] = data.education;
  return (
    <MainSectionSplit
      section="education"
      title="Education"
      firstChild={renderEducationItem(first, 0)}
      restChildren={rest.map((edu, i) => renderEducationItem(edu, i + 1))}
    />
  );
}

// ── Header (page 1 only) ─────────────────────────────────────────────────────

function renderHeader(data: ResumeData) {
  const info = data.personal_info;
  const nameText = info.name?.trim();
  const displayName = nameText || "Your Name";
  const nameStyle = nameText
    ? styles.headerName
    : [styles.headerName, styles.headerNamePlaceholder];
  const roleTitle = deriveRoleTitle(data);

  return (
    <View style={styles.header}>
      <Text style={nameStyle}>{displayName}</Text>
      {roleTitle ? <Text style={styles.headerRole}>{roleTitle}</Text> : null}
      <View style={styles.headerDivider} />
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MinimalTemplate({
  data,
  sectionsOrder,
}: TemplateComponentProps) {
  const order = sectionsOrder?.length ? sectionsOrder : DEFAULT_ORDER;
  // Main column keys we know how to render. Order is preserved from caller-
  // provided sectionsOrder; anything unknown is skipped.
  const mainColumnKeys = new Set(["summary", "experience", "education"]);
  const mainOrder = order.filter((k) => mainColumnKeys.has(k));

  // Sidebar order is fixed — this is a deliberate spec choice (the sidebar
  // is quick-scan meta, not user-reorderable).
  const sidebarSections: React.ReactNode[] = [];
  const c = renderContact(data);
  if (c) sidebarSections.push(<View key="contact">{c}</View>);
  const sk = renderSidebarSkills(data);
  if (sk) sidebarSections.push(<View key="skills">{sk}</View>);
  const lg = renderSidebarLanguages(data);
  if (lg) sidebarSections.push(<View key="languages">{lg}</View>);
  const ce = renderSidebarCertifications(data);
  if (ce) sidebarSections.push(<View key="certs">{ce}</View>);

  const mainSections: React.ReactNode[] = [];
  for (const key of mainOrder) {
    let node: React.ReactNode = null;
    switch (key) {
      case "summary":
        node = renderSummary(data);
        break;
      case "experience":
        node = renderExperience(data);
        break;
      case "education":
        node = renderEducation(data);
        break;
    }
    if (node) mainSections.push(<View key={key}>{node}</View>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header (page 1 only — not wrapped in `fixed` so it doesn't
            repeat on later pages). */}
        {renderHeader(data)}

        <View style={styles.body}>
          {/* Sidebar — fixed width, no timeline. */}
          <View style={styles.sidebar}>{sidebarSections}</View>

          {/* Main column — position:'relative' anchors the timeline.
              The timeline is drawn first (absolute) so section icons
              overlay it; their circles visually punch through the line. */}
          <View style={styles.main}>
            {/* Timeline — spans the full height of the main column. The
                icons sit on top (because they're later children with an
                opaque navy fill). If only ONE section renders, the line
                still draws but is mostly covered by that icon — acceptable.
                On pages 2+, the main column is still position:relative so
                the timeline redraws at the same x-position. */}
            {mainSections.length > 0 && (
              <View
                style={[
                  styles.timelineLine,
                  // Start the line at the vertical center of the first
                  // icon (y = 13pt) and end it 13pt above the bottom so
                  // it doesn't overshoot the last icon. Absolute anchoring
                  // is relative to the main column (position:'relative').
                  { top: SECTION_ICON_RADIUS, bottom: SECTION_ICON_RADIUS },
                ]}
              />
            )}
            {mainSections}
          </View>
        </View>

        {/* Page number footer (pages 2+ only). */}
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

// Re-export for downstream tests that may need to probe the timeline
// x-position or icon size from outside this module.
export { TIMELINE_X };
