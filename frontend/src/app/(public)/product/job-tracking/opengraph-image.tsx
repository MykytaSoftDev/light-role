import { OG_SIZE, renderFeatureOg } from "@/lib/og/feature-og";

export const alt = "Job Application Tracker: Kanban & Table — Light Role";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderFeatureOg({
    line1: "The pipeline that doesn't feel",
    line2: "like a spreadsheet.",
  });
}
