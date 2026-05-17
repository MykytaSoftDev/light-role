import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { BigCta } from "@/components/landing/sections/big-cta";
import { Faq } from "@/components/landing/sections/faq";
import { Features } from "@/components/landing/sections/features";
import { HeroA } from "@/components/landing/sections/hero-a";
import { HowItWorks } from "@/components/landing/sections/how-it-works";
import { LogosStrip } from "@/components/landing/sections/logos-strip";
import { PricingPreview } from "@/components/landing/sections/pricing-preview";
import { SocialProof } from "@/components/landing/sections/social-proof";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lightrole.com";

// Explicit BCP-47 array — NOT derived from SUPPORTED_LOCALES so the internal-only
// `ru` locale can't accidentally leak into hreflang / alternateLocale / inLanguage
// SEO surfaces. See spec D14 + the Russian internal-only constraint.
const LOCALE_BCP47: Record<"en" | "de" | "es" | "fr", string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};
const SEO_BCP47_LOCALES = ["en-US", "de-DE", "es-ES", "fr-FR"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.landing");
  const locale = (await getLocale()) as keyof typeof LOCALE_BCP47;
  const currentBcp47 = LOCALE_BCP47[locale] ?? "en-US";
  const alternateLocales = SEO_BCP47_LOCALES.filter((value) => value !== currentBcp47);

  return {
    metadataBase: new URL(SITE_URL),
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: [
      "AI resume tailoring",
      "job application tracker",
      "cover letter generator",
      "resume optimization",
      "job search organizer",
      "ATS resume",
      "career tools",
    ],
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "/",
      type: "website",
      siteName: "Light Role",
      locale: currentBcp47,
      alternateLocale: alternateLocales,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: t("metaTitle") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: ["/twitter-image"],
    },
    alternates: {
      canonical: "/",
      // languages: populated when path-based locale routing ships (spec D3).
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
    other: {
      "theme-color": "#FFFFFF",
    },
  };
}

export default async function HomePage() {
  const t = await getTranslations("Marketing.landing");
  const tFaq = await getTranslations("Marketing.landing.faq");
  const locale = (await getLocale()) as keyof typeof LOCALE_BCP47;
  const currentBcp47 = LOCALE_BCP47[locale] ?? "en-US";

  const faqQuestions = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => ({
    "@type": "Question",
    name: tFaq(`${id}.question`),
    acceptedAnswer: {
      "@type": "Answer",
      text: tFaq(`${id}.answer`),
    },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Light Role",
        url: SITE_URL,
        logo: `${SITE_URL}/icon`,
        sameAs: [],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "support@lightrole.com",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Light Role",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: SEO_BCP47_LOCALES,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Light Role",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: t("metaDescription"),
        offers: [
          { "@type": "Offer", price: "9.00", priceCurrency: "USD", name: "Pro" },
          { "@type": "Offer", price: "23.00", priceCurrency: "USD", name: "Unlimited" },
        ],
        publisher: { "@id": `${SITE_URL}/#organization` },
        url: SITE_URL,
        inLanguage: SEO_BCP47_LOCALES,
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        inLanguage: currentBcp47,
        mainEntity: faqQuestions,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroA />
      <LogosStrip />
      <HowItWorks />
      <Features />
      <SocialProof />
      <PricingPreview />
      <Faq />
      <BigCta />
    </>
  );
}
