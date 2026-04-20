import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: "#FFFFFF",
    color: "#374151",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSection: {
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    borderBottomStyle: "solid",
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  headerContact: {
    fontSize: 10,
    color: "#6B7280",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 0,
  },
  headerContactText: {
    fontSize: 10,
    color: "#6B7280",
  },
  headerContactLink: {
    fontSize: 10,
    color: "#2563EB",
    textDecoration: "none",
  },

  // ── Section heading ──────────────────────────────────────────────────────────
  sectionContainer: {
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#1F2937",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginBottom: 6,
  },

  // ── Summary ──────────────────────────────────────────────────────────────────
  summaryText: {
    fontSize: 10,
    color: "#374151",
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.5,
  },

  // ── Experience ───────────────────────────────────────────────────────────────
  experienceList: {
    flexDirection: "column",
    gap: 8,
  },
  experienceItem: {
    marginBottom: 6,
  },
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
  experienceDates: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: "#6B7280",
    flexShrink: 0,
  },
  experienceDescription: {
    fontSize: 10,
    fontFamily: "Helvetica-Oblique",
    color: "#4B5563",
    lineHeight: 1.4,
    marginBottom: 3,
  },
  achievementRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  achievementBullet: {
    fontSize: 10,
    color: "#374151",
    width: 12,
    flexShrink: 0,
  },
  achievementText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.4,
    flex: 1,
  },

  // ── Education ────────────────────────────────────────────────────────────────
  educationList: {
    flexDirection: "column",
    gap: 6,
  },
  educationItem: {
    marginBottom: 4,
  },
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
  educationDates: {
    fontSize: 9,
    color: "#6B7280",
    flexShrink: 0,
  },
  educationDegree: {
    fontSize: 10,
    color: "#4B5563",
  },

  // ── Skills / Languages ───────────────────────────────────────────────────────
  bodyText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },

  // ── Certifications ───────────────────────────────────────────────────────────
  certificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  certificationName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  certificationMeta: {
    fontSize: 10,
    color: "#6B7280",
    flexShrink: 0,
  },
});
