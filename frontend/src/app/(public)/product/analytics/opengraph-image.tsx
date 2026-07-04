import { OG_SIZE, renderFeatureOg } from "@/lib/og/feature-og";

export const alt = "Job Search Analytics & Funnel — Light Role";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderFeatureOg({ line1: "Tell a slow week", line2: "from a broken funnel." });
}
