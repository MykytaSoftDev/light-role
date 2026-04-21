// Minimal template — structured professional redesign (VO-2.1).
//
// Concept: structured minimalism. Two-column layout: left sidebar for
// quick-scan meta (Contact, Skills, Languages, Certifications); right main
// column anchored to a 1pt vertical timeline with filled circular icons at
// each section start. The minimalism is DISCIPLINE — single sans-serif
// (Inter), a tight near-black + slate palette, and restraint. NOT
// whitespace alone.
//
// Palette (from spec — ONLY these values):
//   #0F172A — slate-900, primary ink + icon fill + name/headings
//   #334155 — slate-700, body text, company, dates
//   #64748B — slate-500, sidebar labels (optional)
//   #CBD5E1 — slate-300, vertical timeline line
//   #FFFFFF — white paper + icon glyphs inside dark circles
//
// Layout: A4 (595x842pt), outer padding 44pt top/bottom, 48pt left/right.
// Header spans full width; body below is two-column (sidebar ~160pt +
// 24pt gap + flex:1 main). No visual column divider — whitespace only.
//
// Typography — Inter only, weights 400/500/700/800. No Fraunces, no
// italic, no underlines. react-pdf resolves weights from the shared
// registration in ../fonts.ts.

import { StyleSheet } from "@react-pdf/renderer";
import { FONT_SANS } from "../fonts";

// Design tokens (spec-locked). Inlined for clarity — any change needs
// to be reconciled against the acceptance criteria in phase-2 of
// tasks-resume-templates-visual-overhaul.json.
const COLOR_INK = "#0F172A";
const COLOR_BODY = "#334155";
const COLOR_MUTED = "#64748B";
const COLOR_TIMELINE = "#CBD5E1";
const COLOR_WHITE = "#FFFFFF";

// Sidebar width chosen so sidebar + 24pt gap + main column fills the
// writable area (595 - 48*2 = 499pt). 160pt sidebar + 24pt gap leaves
// 315pt for main — roughly 32% / 68%, matching the spec.
const SIDEBAR_WIDTH = 160;
const COLUMN_GAP = 24;

// Main-column section icon dimensions. 26pt circle, centered on the
// 1pt timeline line at x=13pt from the main column's left edge.
export const SECTION_ICON_SIZE = 26;
export const SECTION_ICON_RADIUS = SECTION_ICON_SIZE / 2;
export const TIMELINE_X = SECTION_ICON_RADIUS; // 13pt — timeline centerline
export const TIMELINE_WIDTH = 1;
// Gap between the icon circle and the section-title text that sits to
// its right. The title is vertically centered against the circle.
export const SECTION_TITLE_GAP = 12;

export const styles = StyleSheet.create({
  // ── Page ────────────────────────────────────────────────────────────────────
  page: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    paddingTop: 44,
    paddingBottom: 44,
    paddingLeft: 48,
    paddingRight: 48,
    backgroundColor: COLOR_WHITE,
    color: COLOR_BODY,
  },

  // ── Header (page 1 only) ────────────────────────────────────────────────────
  header: {
    marginBottom: 20,
  },
  headerName: {
    fontFamily: FONT_SANS,
    fontWeight: 800,
    fontSize: 34,
    letterSpacing: 2,
    color: COLOR_INK,
    textTransform: "uppercase",
    lineHeight: 1.05,
  },
  headerNamePlaceholder: {
    color: COLOR_MUTED,
  },
  headerRole: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 3,
    color: COLOR_INK,
    textTransform: "uppercase",
    marginTop: 6,
  },
  headerDivider: {
    marginTop: 14,
    borderBottomWidth: 1.5,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR_INK,
  },

  // ── Two-column body ─────────────────────────────────────────────────────────
  body: {
    flexDirection: "row",
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    marginRight: COLUMN_GAP,
  },
  main: {
    flex: 1,
    // position:'relative' is REQUIRED so the absolutely-positioned
    // timeline line anchors to the main column, not the page.
    position: "relative",
  },

  // ── Sidebar sections ────────────────────────────────────────────────────────
  sidebarSectionGroup: {
    marginBottom: 18,
  },
  sidebarSectionGroupFirst: {
    marginBottom: 18,
  },
  sidebarSectionTitle: {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 2,
    color: COLOR_INK,
    textTransform: "uppercase",
  },
  // Short rule under sidebar section titles — matches the full-width
  // header rule in treatment (same color, same 1pt weight) but only
  // 40pt wide. Sits 6pt below the title text, 10pt above content.
  sidebarSectionRule: {
    marginTop: 6,
    marginBottom: 10,
    width: 40,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: COLOR_INK,
  },

  // Contact row: icon on the left, value on the right. 10pt icon + 6pt
  // gap before value. Rows stack vertically with 6pt gap between.
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  contactIconWrap: {
    width: 10,
    height: 12, // matches sidebarValue line-height to align icon with first text line
    marginRight: 6,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  sidebarLabel: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: 8,
    letterSpacing: 1,
    color: COLOR_MUTED,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  sidebarValue: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_INK,
    lineHeight: 1.4,
    flex: 1,
  },
  sidebarLink: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_INK,
    textDecoration: "none",
    lineHeight: 1.4,
    flex: 1,
  },

  // Bulleted list rows (Skills, Languages). Filled '•' in ink, 6pt gap
  // before the value. No comma runs — each item is its own row.
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  bullet: {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 9.5,
    color: COLOR_INK,
    width: 8,
    flexShrink: 0,
    lineHeight: 1.4,
  },
  bulletText: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_INK,
    lineHeight: 1.4,
    flex: 1,
  },

  // Sidebar certifications — name on first line (ink), meta on second
  // line (muted). No comma runs across items.
  sidebarCertItem: {
    marginBottom: 6,
  },
  sidebarCertName: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: 9.5,
    color: COLOR_INK,
    lineHeight: 1.4,
  },
  sidebarCertMeta: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 8.5,
    color: COLOR_MUTED,
    lineHeight: 1.4,
  },

  // ── Main column — timeline and section rows ─────────────────────────────────
  timelineLine: {
    position: "absolute",
    left: TIMELINE_X,
    // top/bottom anchor dynamically — see index.tsx which sets top based
    // on the first icon's top-offset and bottom based on the last.
    width: TIMELINE_WIDTH,
    backgroundColor: COLOR_TIMELINE,
  },
  // Each main-column section is a row with [icon circle | title + content].
  // The icon is the first child (26x26, flush-left at x=0). Title sits
  // to its right, vertically centered with the icon.
  mainSectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  mainSectionRowFirst: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    marginTop: 0,
  },
  mainSectionIcon: {
    width: SECTION_ICON_SIZE,
    height: SECTION_ICON_SIZE,
    borderRadius: SECTION_ICON_RADIUS,
    backgroundColor: COLOR_INK,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mainSectionBody: {
    flex: 1,
    marginLeft: SECTION_TITLE_GAP,
    // No background needed — the body sits at main-column-x = 38pt
    // (26pt icon width + 12pt gap), well to the right of the timeline
    // line at x = 13pt. The icon circle's opaque navy fill covers the
    // timeline segment that passes through it.
  },
  mainSectionTitle: {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 2,
    color: COLOR_INK,
    textTransform: "uppercase",
    // Vertically align against the 26pt circle's center. The circle's
    // center sits at y=13; with fontSize:12 and lineHeight:1, the title
    // baseline needs ≈7pt top padding to visually center.
    marginTop: 7,
    marginBottom: 8,
  },

  // Profile / summary body
  summaryText: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
  },

  // ── Experience ──────────────────────────────────────────────────────────────
  experienceItem: {
    marginBottom: 10,
  },
  experienceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  experienceTitle: {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 10.5,
    color: COLOR_INK,
    flex: 1,
    paddingRight: 8,
  },
  experienceDates: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_BODY,
    flexShrink: 0,
  },
  experienceCompany: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    marginTop: 1,
  },
  experienceDescription: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
    marginTop: 4,
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
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 10,
    color: COLOR_INK,
    width: 8,
    flexShrink: 0,
    lineHeight: 1.5,
  },
  achievementText: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    lineHeight: 1.5,
    flex: 1,
  },

  // ── Education ───────────────────────────────────────────────────────────────
  educationItem: {
    marginBottom: 8,
  },
  educationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  educationInstitution: {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 10.5,
    color: COLOR_INK,
    flex: 1,
    paddingRight: 8,
  },
  educationDates: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9.5,
    color: COLOR_BODY,
    flexShrink: 0,
  },
  educationDegree: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: COLOR_BODY,
    marginTop: 1,
    lineHeight: 1.4,
  },

  // ── Page number footer ──────────────────────────────────────────────────────
  pageNumber: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9,
    color: COLOR_MUTED,
  },
});
