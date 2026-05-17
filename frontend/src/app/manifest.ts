import type { MetadataRoute } from "next";

// theme_color and background_color must be literal hex (manifests don't support oklch()).
// Resolved from globals.css :root tokens:
//   --background: oklch(98% 0 0)        → ~#FAFAFA, treat as white for the manifest splash
//   --primary:    oklch(60% 0.2 120)    → ~#5FA90E, a close sRGB approximation of the brand green
const BACKGROUND_LIGHT_HEX = "#FFFFFF";
const PRIMARY_HEX = "#5FA90E";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Light Role",
    short_name: "Light Role",
    description: "AI resume tailoring and job application tracking.",
    start_url: "/",
    display: "standalone",
    background_color: BACKGROUND_LIGHT_HEX,
    theme_color: PRIMARY_HEX,
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
