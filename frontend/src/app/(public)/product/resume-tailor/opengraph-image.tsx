import { OG_SIZE, renderFeatureOg } from "@/lib/og/feature-og";

export const alt = "AI Resume Tailoring for Every Job — Light Role";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderFeatureOg({ line1: "One profile. Every resume,", line2: "tailored." });
}
