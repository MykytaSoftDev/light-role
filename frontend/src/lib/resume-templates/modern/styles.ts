import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: "#FFFFFF",
  },

  // ── Full-width header band ────────────────────────────────────────────────────
  header: {
    paddingTop: 32,
    paddingBottom: 20,
    paddingLeft: 32,
    paddingRight: 32,
    backgroundColor: "#4F46E5",
  },
  headerName: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  headerRole: {
    fontSize: 13,
    color: "#C7D2FE",
    marginTop: 3,
  },
  headerContact: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 0,
  },
  headerContactText: {
    fontSize: 9,
    color: "#C7D2FE",
  },
  headerContactLink: {
    fontSize: 9,
    color: "#C7D2FE",
    textDecoration: "none",
  },

  // ── Two-column container ─────────────────────────────────────────────────────
  columnsContainer: {
    flexDirection: "row",
    flex: 1,
  },

  // ── Left sidebar ─────────────────────────────────────────────────────────────
  leftColumn: {
    width: "35%",
    backgroundColor: "#EEF2FF",
    paddingTop: 40,
    paddingLeft: 24,
    paddingRight: 16,
    paddingBottom: 40,
  },
  leftSectionHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#4F46E5",
    marginBottom: 6,
    marginTop: 14,
  },
  leftSectionHeadingFirst: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#4F46E5",
    marginBottom: 6,
    marginTop: 0,
  },
  leftBodyText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },

  // Contact items in left column
  contactRow: {
    marginBottom: 5,
  },
  contactLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#4F46E5",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  contactValue: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.4,
  },
  contactLink: {
    fontSize: 9,
    color: "#4F46E5",
    textDecoration: "none",
    lineHeight: 1.4,
  },

  // Skills tags
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skillTag: {
    fontSize: 9,
    color: "#4F46E5",
    marginRight: 4,
    marginBottom: 2,
  },

  // ── Right main column ─────────────────────────────────────────────────────────
  rightColumn: {
    width: "65%",
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
    paddingLeft: 24,
    paddingRight: 32,
    paddingBottom: 40,
  },
  rightSectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#4F46E5",
    borderBottomWidth: 1,
    borderBottomColor: "#C7D2FE",
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginBottom: 6,
    marginTop: 14,
  },
  rightSectionHeadingFirst: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#4F46E5",
    borderBottomWidth: 1,
    borderBottomColor: "#C7D2FE",
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginBottom: 6,
    marginTop: 0,
  },

  // Summary
  summaryText: {
    fontSize: 10,
    color: "#4B5563",
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.4,
  },

  // Experience
  experienceList: {
    flexDirection: "column",
  },
  experienceItem: {
    marginBottom: 8,
  },
  experienceTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  experienceCompanyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 1,
    marginBottom: 3,
  },
  experienceCompany: {
    fontSize: 9,
    color: "#6B7280",
  },
  experienceDates: {
    fontSize: 9,
    color: "#6B7280",
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
    color: "#4F46E5",
    width: 12,
    flexShrink: 0,
  },
  achievementText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.4,
    flex: 1,
  },

  // Education
  educationList: {
    flexDirection: "column",
  },
  educationItem: {
    marginBottom: 6,
  },
  educationInstitution: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  educationDates: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 1,
    marginBottom: 2,
  },
  educationDegree: {
    fontSize: 10,
    color: "#4B5563",
  },

  // Certifications (left column)
  certificationItem: {
    marginBottom: 5,
  },
  certificationName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
  },
  certificationMeta: {
    fontSize: 9,
    color: "#6B7280",
  },
});
