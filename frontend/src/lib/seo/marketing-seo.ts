import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

// Explicit BCP-47 array — NOT derived from SUPPORTED_LOCALES so the internal-only
// `ru` locale can't accidentally leak into hreflang / alternateLocale / inLanguage
// SEO surfaces. Mirrors the values in src/app/(public)/page.tsx.
export const LOCALE_BCP47: Record<"en" | "de" | "es" | "fr", string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

export const SEO_BCP47_LOCALES = ["en-US", "de-DE", "es-ES", "fr-FR"];

export interface BuildProductMetadataArgs {
  locale: string;
  title: string;
  description: string;
  keywords: string[];
  /** Absolute-from-root path for this page, e.g. "/product/resume-tailor". */
  path: string;
}

/**
 * Builds the full Metadata object for a public product marketing page, matching
 * the home-page pattern (openGraph / twitter / alternates / robots). OG + Twitter
 * images point at the per-page `${path}/opengraph-image` and `${path}/twitter-image`.
 */
export function buildProductMetadata({
  locale,
  title,
  description,
  keywords,
  path,
}: BuildProductMetadataArgs): Metadata {
  const currentBcp47 = LOCALE_BCP47[locale as keyof typeof LOCALE_BCP47] ?? "en-US";
  const alternateLocales = SEO_BCP47_LOCALES.filter((value) => value !== currentBcp47);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      siteName: "Light Role",
      locale: currentBcp47,
      alternateLocale: alternateLocales,
      // No explicit `images`: the route's file-convention opengraph-image.tsx is
      // auto-injected by Next with the correct content-hashed URL (+ width/height/alt
      // from its exports). Hardcoding `${path}/opengraph-image` produced a 404 URL.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // No explicit `images`: twitter-image.tsx is auto-injected with its hashed URL.
    },
    alternates: {
      canonical: path,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    formatDetection: { email: false, telephone: false, address: false },
  };
}
