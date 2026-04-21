// Modern template — "Anna Johnson" dark-sidebar editorial (VO-1.1).
//
// Concept: a grayscale-only editorial resume. A full-width header band at the
// top of page 1 carries a wide-letter-spaced uppercase name in LIGHT weight
// (the elegance comes from the spacing, not the weight), followed by a light
// gray subtitle band with the role title. Below that, a two-column body:
//   - Left sidebar (190pt, ~32%) in dark charcoal #1A1A1A with pale text.
//   - Right main column (flex:1, ~68%) on white with dark text.
//
// No accent hues. No decorative elements. The dark sidebar IS the brand.
//
// Palette (exhaustive — any other color in this file is a bug):
//   #1A1A1A — charcoal: sidebar background + name + main section titles +
//             main bullets + main job titles
//   #262626 — body text (main column)
//   #4A4A4A — rule color under sidebar section titles
//   #525252 — company/date meta + subtitle role text
//   #999999 — sidebar labels + sidebar date de-emphasis + placeholder name
//   #D4D4D4 — header hairline rule + rule under main section titles
//   #E5E5E5 — sidebar value text (near-white, softer than pure #FFFFFF) +
//             sidebar bullets + contact icons
//   #F5F5F5 — subtitle band background (light gray)
//   #FFFFFF — sidebar section titles + paper background
//
// Typography: Inter only. Weights 300, 400, 500, 600, 700. letterSpacing is
// measured in points (react-pdf interprets it as absolute pt-spacing between
// glyphs, which matches CSS letter-spacing in px at the PDF scale).

import { StyleSheet } from "@react-pdf/renderer";

const COLOR_CHARCOAL = "#1A1A1A";
const COLOR_BODY = "#262626";
const COLOR_RULE_DARK = "#4A4A4A";
const COLOR_META = "#525252";
const COLOR_MUTED = "#999999";
const COLOR_RULE_LIGHT = "#D4D4D4";
const COLOR_SIDEBAR_TEXT = "#E5E5E5";
const COLOR_BAND_BG = "#F5F5F5";
const COLOR_WHITE = "#FFFFFF";

const FONT = "Inter";

// Layout constants — referenced from index.tsx for the absolute-positioned
// sidebar background on subsequent pages, so keep them here as the single
// source of truth.
export const SIDEBAR_WIDTH = 190;
export const HEADER_NAME_BLOCK_HEIGHT = 90; // white area with name
export const HEADER_SUBTITLE_BAND_HEIGHT = 34; // light-gray band with role
export const HEADER_BAND_HEIGHT = HEADER_NAME_BLOCK_HEIGHT + HEADER_SUBTITLE_BAND_HEIGHT;

export const styles = StyleSheet.create({
  // ── Page ────────────────────────────────────────────────────────────────────
  // Zero outer padding — the sidebar reaches the left paper edge.
  page: {
    fontFamily: FONT,
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: COLOR_WHITE,
    color: COLOR_BODY,
  },

  // ── Sidebar background (painted on every page via `fixed`) ─────────────────
  // A full-height, left-anchored charcoal rectangle behind the sidebar column.
  // Rendered with position:"absolute" + the `fixed` prop on a standalone View
  // so the dark fill persists on pages 2+ even though the sidebar content
  // itself lives inside the flow and only renders on page 1.
  sidebarBackground: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: COLOR_CHARCOAL,
  },

  // ── Header band (page 1 only) ──────────────────────────────────────────────
  // Spans full paper width. Contains (1) white block with centered name and
  // (2) light-gray subtitle band with role. A 1pt #D4D4D4 rule separates them.
  headerBand: {
    width: "100%",
  },
  headerNameBlock: {
    height: HEADER_NAME_BLOCK_HEIGHT,
    backgroundColor: COLOR_WHITE,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 26,
    paddingBottom: 18,
    paddingLeft: 32,
    paddingRight: 32,
  },
  name: {
    fontFamily: FONT,
    fontWeight: 300,
    fontSize: 36,
    letterSpacing: 8,
    color: COLOR_CHARCOAL,
    textTransform: "uppercase",
    textAlign: "center",
    // LineHeight intentionally tight — spacing is horizontal, not vertical.
    lineHeight: 1.15,
  },
  nameEmpty: {
    fontFamily: FONT,
    fontWeight: 300,
    fontSize: 36,
    letterSpacing: 8,
    color: COLOR_MUTED,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 1.15,
  },
  headerDivider: {
    width: "100%",
    height: 1,
    backgroundColor: COLOR_RULE_LIGHT,
  },
  headerSubtitleBand: {
    height: HEADER_SUBTITLE_BAND_HEIGHT,
    backgroundColor: COLOR_BAND_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 32,
    paddingRight: 32,
  },
  roleTitle: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 4,
    color: COLOR_META,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // ── Body: two-column layout below the header ───────────────────────────────
  // flex:1 ensures the columns fill remaining page height so the sidebar
  // background lines up visually with the flow content.
  body: {
    flexDirection: "row",
    flex: 1,
  },

  // Left column — 190pt, dark charcoal, only renders flow content on page 1.
  // On subsequent pages the charcoal is painted by the `fixed` background.
  sidebar: {
    width: SIDEBAR_WIDTH,
    // Transparent: the actual dark fill is the fixed-background View. Keeping
    // this View transparent avoids double-drawing and lets layout flow
    // naturally without creating a second dark rectangle in the flow.
    backgroundColor: "transparent",
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 24,
    paddingRight: 24,
  },

  // Right column — white, flex:1. Wraps across pages; sidebar does not.
  main: {
    flex: 1,
    backgroundColor: COLOR_WHITE,
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 32,
    paddingRight: 32,
  },

  // ── Sidebar section titles & rule ─────────────────────────────────────────
  sidebarSectionTitle: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 2,
    color: COLOR_WHITE,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 6,
  },
  sidebarSectionTitleFirst: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 2,
    color: COLOR_WHITE,
    textTransform: "uppercase",
    marginTop: 0,
    marginBottom: 6,
  },
  sidebarSectionRule: {
    height: 1,
    backgroundColor: COLOR_RULE_DARK,
    marginBottom: 12,
  },

  // ── Sidebar contact rows ──────────────────────────────────────────────────
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  contactIconBox: {
    width: 14,
    height: 14,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    // Align icon visually with first line of text (~9pt @ 1.4 lh).
    marginTop: 0.5,
  },
  contactValue: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_SIDEBAR_TEXT,
    lineHeight: 1.4,
    flex: 1,
  },
  contactLink: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_SIDEBAR_TEXT,
    lineHeight: 1.4,
    flex: 1,
    textDecoration: "none",
  },

  // ── Sidebar education (if placed in sidebar) ──────────────────────────────
  sidebarEduItem: {
    marginBottom: 10,
  },
  sidebarEduDegree: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 1,
    color: COLOR_WHITE,
    textTransform: "uppercase",
    lineHeight: 1.3,
    marginBottom: 1,
  },
  sidebarEduInstitution: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_SIDEBAR_TEXT,
    lineHeight: 1.4,
  },
  sidebarEduDates: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_MUTED,
    lineHeight: 1.4,
    marginTop: 1,
  },

  // ── Sidebar skills ─────────────────────────────────────────────────────────
  sidebarSubHeading: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 1,
    color: COLOR_WHITE,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 4,
  },
  sidebarSubHeadingFirst: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 1,
    color: COLOR_WHITE,
    textTransform: "uppercase",
    marginTop: 0,
    marginBottom: 4,
  },
  sidebarBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  sidebarBullet: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_SIDEBAR_TEXT,
    width: 8,
    flexShrink: 0,
    lineHeight: 1.4,
  },
  sidebarBulletText: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_SIDEBAR_TEXT,
    lineHeight: 1.4,
    flex: 1,
  },

  // ── Main column: section titles & rule ────────────────────────────────────
  mainSectionTitle: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 2,
    color: COLOR_CHARCOAL,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 6,
  },
  mainSectionTitleFirst: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 2,
    color: COLOR_CHARCOAL,
    textTransform: "uppercase",
    marginTop: 0,
    marginBottom: 6,
  },
  mainSectionRule: {
    height: 1,
    backgroundColor: COLOR_RULE_LIGHT,
    marginBottom: 12,
  },

  // ── Profile (summary) ──────────────────────────────────────────────────────
  profileText: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
  },

  // ── Experience ─────────────────────────────────────────────────────────────
  experienceItem: {
    marginBottom: 12,
  },
  experienceTitle: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: COLOR_CHARCOAL,
    textTransform: "uppercase",
    lineHeight: 1.3,
  },
  // "Company | Dates" on its own line beneath the job title, #525252.
  experienceMeta: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_META,
    marginTop: 1,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  experienceDescription: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
    marginTop: 2,
  },
  achievementsContainer: {
    marginTop: 4,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  achievementBullet: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_CHARCOAL,
    width: 10,
    flexShrink: 0,
    lineHeight: 1.5,
  },
  achievementText: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
    flex: 1,
  },

  // ── Education in main column (when at least one entry has description) ────
  mainEduItem: {
    marginBottom: 10,
  },
  mainEduHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  mainEduInstitution: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: COLOR_CHARCOAL,
    textTransform: "uppercase",
    flex: 1,
    paddingRight: 8,
    lineHeight: 1.3,
  },
  mainEduDates: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_META,
  },
  mainEduDegree: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_META,
    marginTop: 1,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  mainEduDescription: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
    marginTop: 2,
  },

  // ── Certifications (main column) ──────────────────────────────────────────
  certificationItem: {
    marginBottom: 6,
  },
  certificationName: {
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 10,
    color: COLOR_CHARCOAL,
    lineHeight: 1.4,
  },
  certificationMeta: {
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_META,
    lineHeight: 1.4,
    marginTop: 1,
  },

  // ── Page number footer ────────────────────────────────────────────────────
  // Right-aligned in the main column area (leaves the sidebar clean).
  pageNumber: {
    position: "absolute",
    bottom: 20,
    left: SIDEBAR_WIDTH + 32,
    right: 32,
    textAlign: "right",
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 8,
    color: COLOR_MUTED,
  },
});
