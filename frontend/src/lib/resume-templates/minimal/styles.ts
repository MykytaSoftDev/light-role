import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 60,
    paddingBottom: 60,
    paddingLeft: 60,
    paddingRight: 60,
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSection: {
    marginBottom: 20,
  },
  headerName: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  headerRole: {
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Helvetica",
    marginBottom: 6,
  },
  headerContact: {
    fontSize: 10,
    color: "#6B7280",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  headerContactText: {
    fontSize: 10,
    color: "#6B7280",
  },
  headerContactLink: {
    fontSize: 10,
    color: "#6B7280",
    textDecoration: "none",
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderBottomStyle: "solid",
    marginTop: 12,
  },

  // ── Section ──────────────────────────────────────────────────────────────────
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#111827",
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Summary ──────────────────────────────────────────────────────────────────
  summaryText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.6,
  },

  // ── Experience ───────────────────────────────────────────────────────────────
  experienceList: { flexDirection: "column", gap: 12 },
  experienceItem: { marginBottom: 4 },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  experienceTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  experienceCompany: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
  },
  experienceDates: {
    fontSize: 9,
    color: "#6B7280",
    flexShrink: 0,
  },
  experienceDescription: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 3,
  },
  achievementRow: { flexDirection: "row", marginBottom: 2 },
  achievementBullet: {
    fontSize: 10,
    color: "#6B7280",
    width: 16,
    flexShrink: 0,
  },
  achievementText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
    flex: 1,
  },

  // ── Education ────────────────────────────────────────────────────────────────
  educationList: { flexDirection: "column", gap: 8 },
  educationItem: { marginBottom: 2 },
  educationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 1,
  },
  educationInstitution: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  educationDates: { fontSize: 9, color: "#6B7280", flexShrink: 0 },
  educationDegree: { fontSize: 10, color: "#6B7280" },

  // ── Skills / Languages ───────────────────────────────────────────────────────
  bodyText: { fontSize: 10, color: "#374151", lineHeight: 1.5 },

  // ── Certifications ───────────────────────────────────────────────────────────
  certificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  certificationName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  certificationMeta: { fontSize: 10, color: "#6B7280", flexShrink: 0 },
});
