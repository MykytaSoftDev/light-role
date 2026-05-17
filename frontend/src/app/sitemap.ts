import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

// When path-based locale routing ships, enumerate per-locale entries for the FOUR user-facing
// locales (en/de/es/fr) — never five. Russian is internal-only (kept in messages/ for parity check).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/auth/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/auth/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
