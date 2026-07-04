import { OG_SIZE, renderFeatureOg } from "@/lib/og/feature-og";

export const alt = "AI Cover Letter Generator — Light Role";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderFeatureOg({
    line1: "Cover letters in seconds,",
    line2: "that read like you wrote them.",
  });
}
