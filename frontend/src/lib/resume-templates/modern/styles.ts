import { StyleSheet } from "@react-pdf/renderer";

// Modern template — sidebar-as-feature.
//
// Layout: 180pt lavender-gray sidebar at paper edge, flex:1 white main column.
// A 3pt indigo vertical accent bar runs flush-left inside the sidebar. The
// name lives at the TOP of the main column, not in the sidebar. All fonts are
// Inter (registered in ../fonts.ts); bullets use the '›' chevron in indigo.

const COLOR_INDIGO = "#4F46E5"; // accent + section headings + role title
const COLOR_SLATE_900 = "#0F172A"; // name
const COLOR_SLATE_800 = "#1E293B"; // body
const COLOR_SLATE_500 = "#64748B"; // dates + muted labels
const COLOR_BORDER = "#E2E8F0"; // skill-pill border
const COLOR_SIDEBAR_BG = "#F1F2F7"; // soft lavender-gray
const COLOR_WHITE = "#FFFFFF";
const COLOR_NAME_PLACEHOLDER = "#CBD5E1"; // muted slate for empty-name state

export const styles = StyleSheet.create({
  // ── Page ────────────────────────────────────────────────────────────────────
  // Zero outer padding — the sidebar reaches the paper edges. Paper is always
  // white regardless of app theme.
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: COLOR_WHITE,
    color: COLOR_SLATE_800,
  },

  // ── Two-column body ─────────────────────────────────────────────────────────
  columnsContainer: {
    flexDirection: "row",
    flex: 1,
  },

  // ── Left sidebar ────────────────────────────────────────────────────────────
  // Fixed 180pt width, full paper height, soft lavender-gray background.
  // Extra bottom padding so the fixed page-number footer never clashes with
  // content on long resumes.
  sidebar: {
    width: 180,
    backgroundColor: COLOR_SIDEBAR_BG,
    paddingTop: 32,
    paddingLeft: 32,
    paddingRight: 24,
    paddingBottom: 48,
    position: "relative",
  },
  // 3pt indigo vertical accent bar flush-left, full sidebar height.
  sidebarAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLOR_INDIGO,
  },

  sidebarSectionTitle: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLOR_INDIGO,
    marginTop: 18,
    marginBottom: 6,
  },
  sidebarSectionTitleFirst: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLOR_INDIGO,
    marginTop: 0,
    marginBottom: 6,
  },

  // Contact
  contactRow: {
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: COLOR_SLATE_500,
    marginBottom: 1,
  },
  contactValue: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    lineHeight: 1.4,
  },
  contactLink: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_INDIGO,
    textDecoration: "none",
    lineHeight: 1.4,
  },

  // Skills — pill-shaped tags
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  skillPill: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    backgroundColor: COLOR_WHITE,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderStyle: "solid",
    borderRadius: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 8,
    paddingRight: 8,
  },

  // Languages / simple list
  sidebarBody: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    lineHeight: 1.5,
  },

  // Certifications
  certificationItem: {
    marginBottom: 6,
  },
  certificationName: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 600,
    color: COLOR_SLATE_900,
    lineHeight: 1.4,
  },
  certificationMeta: {
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_500,
    lineHeight: 1.4,
  },

  // ── Right main column ───────────────────────────────────────────────────────
  main: {
    flex: 1,
    backgroundColor: COLOR_WHITE,
    paddingTop: 36,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 48,
  },

  // Name block at top of main column
  nameBlock: {
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontFamily: "Inter",
    fontWeight: 700,
    letterSpacing: -0.5,
    color: COLOR_SLATE_900,
    lineHeight: 1.1,
  },
  nameEmpty: {
    fontSize: 28,
    fontFamily: "Inter",
    fontWeight: 700,
    letterSpacing: -0.5,
    color: COLOR_NAME_PLACEHOLDER,
    lineHeight: 1.1,
  },
  roleTitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: 500,
    color: COLOR_INDIGO,
    marginTop: 4,
    lineHeight: 1.2,
  },

  // Section titles on main — label only, no underline, no divider.
  mainSectionTitle: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLOR_INDIGO,
    marginTop: 18,
    marginBottom: 8,
  },
  mainSectionTitleFirst: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLOR_INDIGO,
    marginTop: 0,
    marginBottom: 8,
  },

  // Summary
  summaryText: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    lineHeight: 1.5,
  },

  // Experience
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  experienceTitle: {
    fontSize: 11,
    fontFamily: "Inter",
    fontWeight: 600,
    color: COLOR_SLATE_900,
    flex: 1,
    paddingRight: 8,
  },
  experienceDates: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: COLOR_SLATE_500,
  },
  experienceCompany: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 500,
    color: COLOR_INDIGO,
    marginTop: 1,
  },
  experienceLocation: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_500,
    marginTop: 1,
  },
  experienceDescription: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    lineHeight: 1.5,
    marginTop: 4,
  },
  achievementsContainer: {
    marginTop: 4,
  },
  achievementRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  achievementBullet: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 600,
    color: COLOR_INDIGO,
    width: 10,
    flexShrink: 0,
    lineHeight: 1.5,
  },
  achievementText: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    lineHeight: 1.5,
    flex: 1,
  },

  // Education
  educationItem: {
    marginBottom: 8,
  },
  educationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  educationInstitution: {
    fontSize: 11,
    fontFamily: "Inter",
    fontWeight: 600,
    color: COLOR_SLATE_900,
    flex: 1,
    paddingRight: 8,
  },
  educationDates: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: COLOR_SLATE_500,
  },
  educationDegree: {
    fontSize: 10,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_800,
    marginTop: 1,
    lineHeight: 1.4,
  },

  // ── Fixed page-number footer ────────────────────────────────────────────────
  // Absolute + `fixed` keeps it out of content flow. Only rendered when
  // totalPages > 1 (see index.tsx).
  footer: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 400,
    color: COLOR_SLATE_500,
  },
});
