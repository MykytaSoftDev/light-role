import type { MetadataRoute } from "next";

// theme_color and background_color must be literal hex (manifests don't support oklch()).
// Both are kept as white so the PWA splash / browser chrome matches the site's
// light theme-color (unified across the root <meta name="theme-color"> and this manifest).
const BACKGROUND_LIGHT_HEX = "#FFFFFF";
const THEME_COLOR_HEX = "#FFFFFF";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Light Role",
    short_name: "Light Role",
    description: "AI resume tailoring and job application tracking.",
    start_url: "/",
    display: "standalone",
    background_color: BACKGROUND_LIGHT_HEX,
    theme_color: THEME_COLOR_HEX,
    icons: [
      { src: "/assets/logo/lightrole-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/assets/logo/lightrole-icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
