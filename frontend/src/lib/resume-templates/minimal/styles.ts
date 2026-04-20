// Minimal template — editorial redesign (RTV-3.1).
//
// Typography-first aesthetic: serif display (Fraunces) for name + section
// titles, sans body (Inter) for everything else. Premium signal comes from
// restraint, font pairing, and vertical rhythm — NOT color or decoration.
//
// Palette (from spec): near-black + neutral scale only. No pure #000000.
//   #0A0A0A — primary ink
//   #262626 — body
//   #525252 — secondary/meta
//   #737373 — tertiary/dates
//   #A3A3A3 — em-dash bullets
//   #E5E5E5 — the single hairline rule under header
//
// Layout: A4 page, 64pt top/bottom, 72pt left/right. Single column.
// The only horizontal rule is the 1pt hairline under the header block.

import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10.5,
    paddingTop: 64,
    paddingBottom: 64,
    paddingLeft: 72,
    paddingRight: 72,
    backgroundColor: "#FFFFFF",
    color: "#262626",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSection: {
    marginBottom: 8,
  },
  headerName: {
    fontFamily: "Fraunces",
    fontWeight: 600,
    fontSize: 36,
    letterSpacing: -1,
    color: "#0A0A0A",
    lineHeight: 1.1,
  },
  // Cyrillic fallback: Fraunces lacks a Cyrillic subset on fontsource, so for
  // names containing Cyrillic letters we swap to Inter 600 at the same size.
  // It's sans, not serif, but legible — documented trade-off per RTV-3.1.
  headerNameCyrillic: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 36,
    letterSpacing: -1,
    color: "#0A0A0A",
    lineHeight: 1.1,
  },
  headerNamePlaceholder: {
    color: "#A3A3A3",
  },
  headerRole: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: 14,
    color: "#525252",
    marginTop: 4,
  },
  headerContact: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  headerContactText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10,
    color: "#525252",
  },
  headerContactLink: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10,
    color: "#525252",
    textDecoration: "none",
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    borderBottomStyle: "solid",
    marginTop: 14,
  },

  // ── Section container + heading ─────────────────────────────────────────────
  sectionContainer: {
    marginTop: 24, // 24pt gap before each section title (vertical rhythm)
  },
  sectionHeading: {
    fontFamily: "Fraunces",
    fontWeight: 600,
    fontSize: 11,
    color: "#0A0A0A",
    marginBottom: 12,
    // Note: sentence case ("Experience"), NOT uppercase. No letterSpacing.
  },
  // Cyrillic fallback for section headings (if ever localized). Not used for
  // the hard-coded English section titles below, but kept for completeness.
  sectionHeadingCyrillic: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 11,
    color: "#0A0A0A",
    marginBottom: 12,
  },

  // ── Summary ─────────────────────────────────────────────────────────────────
  summaryText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#262626",
    lineHeight: 1.6,
  },

  // ── Experience ──────────────────────────────────────────────────────────────
  experienceList: {
    flexDirection: "column",
    gap: 14,
  },
  experienceItem: {
    flexDirection: "column",
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  experienceTitleLine: {
    flex: 1,
    marginRight: 12,
    fontSize: 11,
    color: "#0A0A0A",
    lineHeight: 1.4,
  },
  experienceTitle: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 11,
    color: "#0A0A0A",
  },
  experienceCompany: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 11,
    color: "#0A0A0A",
  },
  experienceSeparator: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 11,
    color: "#737373",
  },
  experienceDates: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: 10,
    color: "#737373",
    flexShrink: 0,
  },
  experienceDescription: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#262626",
    lineHeight: 1.6,
    marginTop: 4,
  },
  achievementsList: {
    flexDirection: "column",
    marginTop: 4,
  },
  // Bullets: em-dash '—' in neutral-400, using a row with hanging indent.
  // Chosen over plain-paragraph style because em-dash reads as editorial
  // punctuation (matches the 'Fraunces editorial' concept) while keeping
  // the spec's 'no filled circles' rule.
  achievementRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  achievementBullet: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#A3A3A3",
    width: 14,
    flexShrink: 0,
    lineHeight: 1.6,
  },
  achievementText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#262626",
    lineHeight: 1.6,
    flex: 1,
  },

  // ── Education ───────────────────────────────────────────────────────────────
  educationList: {
    flexDirection: "column",
    gap: 10,
  },
  educationItem: {
    flexDirection: "column",
  },
  educationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  educationInstitution: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 11,
    color: "#0A0A0A",
    flex: 1,
    marginRight: 12,
  },
  educationDates: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: 10,
    color: "#737373",
    flexShrink: 0,
  },
  educationDegree: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#262626",
    lineHeight: 1.6,
  },

  // ── Skills / Languages (labeled-group line) ─────────────────────────────────
  // Renders as 'Skills — JavaScript, TypeScript, …' with the label slightly
  // darker than the value to add editorial hierarchy without a bullet run.
  labeledLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  labeledLabel: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 10.5,
    color: "#0A0A0A",
  },
  labeledDash: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#A3A3A3",
  },
  labeledValue: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10.5,
    color: "#262626",
    lineHeight: 1.6,
    flex: 1,
  },

  // ── Certifications ──────────────────────────────────────────────────────────
  certificationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  certificationName: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10.5,
    color: "#0A0A0A",
    flex: 1,
    marginRight: 12,
  },
  certificationMeta: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: 10,
    color: "#737373",
    flexShrink: 0,
  },

  // ── Page number (pages 2+ only) ─────────────────────────────────────────────
  pageNumber: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Fraunces",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: 9,
    color: "#737373",
  },
});
