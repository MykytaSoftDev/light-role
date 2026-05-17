import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/auth/login", "/auth/register"],
        disallow: ["/dashboard/", "/api/", "/auth/callback/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
