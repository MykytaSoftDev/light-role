import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  FeatureLanding,
  type FeatureLandingContent,
} from "@/components/landing/product/feature-landing";
import type { FeatureIconName } from "@/components/landing/product/feature-icon";
import { AnalyticsHeroShot } from "@/components/landing/product/shots/analytics-hero-shot";
import { getAuthState } from "@/lib/auth/get-auth-state";
import {
  buildProductMetadata,
  LOCALE_BCP47,
  SITE_URL,
} from "@/lib/seo/marketing-seo";

const PATH = "/product/analytics";
const KEYWORDS = [
  "job search analytics",
  "application funnel conversion",
  "job search metrics",
  "application velocity tracking",
  "job search dashboard",
];
const FEATURE_ICONS: FeatureIconName[] = ["chart", "clock", "funnel", "grid", "bolt", "activity"];
const FEATURE_IDS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const FAQ_IDS = ["q1", "q2", "q3"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.product.analytics");
  const locale = await getLocale();
  return buildProductMetadata({
    locale,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: KEYWORDS,
    path: PATH,
  });
}

export default async function AnalyticsPage() {
  const t = await getTranslations("Marketing.product.analytics");
  const tShared = await getTranslations("Marketing.product.shared");
  const locale = await getLocale();
  const { isAuthenticated } = await getAuthState();
  const currentBcp47 = LOCALE_BCP47[locale as keyof typeof LOCALE_BCP47] ?? "en-US";

  const primaryLabel = isAuthenticated ? tShared("ctaPrimaryAuthed") : tShared("ctaPrimary");
  const faqItems = FAQ_IDS.map((id) => ({
    question: t(`faq.${id}.question`),
    answer: t(`faq.${id}.answer`),
  }));

  const content: FeatureLandingContent = {
    eyebrow: t("eyebrow"),
    kicker: t("kicker"),
    title: t("title"),
    titleAccent: t("titleAccent"),
    body: t("body"),
    ctaPrimaryLabel: primaryLabel,
    ctaSecondaryLabel: tShared("ctaSecondary"),
    subFeatures: {
      kicker: tShared("subFeaturesKicker"),
      title: tShared("subFeaturesTitle"),
      items: FEATURE_IDS.map((id, i) => ({
        icon: FEATURE_ICONS[i],
        title: t(`features.${id}.title`),
        body: t(`features.${id}.body`),
      })),
    },
    testimonial: {
      quote: t("testimonial.quote"),
      name: "Sara Okafor",
      role: t("testimonial.role"),
      avatarColor: "#FFD6CC",
      initials: "SO",
    },
    faq: {
      kicker: tShared("faqKicker"),
      title: tShared("faqTitle"),
      items: faqItems,
    },
    cta: {
      title: t("ctaTitle"),
      subtitle: tShared("ctaSubtitle"),
      primaryLabel,
      secondaryLabel: tShared("ctaSeePricing"),
    },
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Light Role", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: t("breadcrumbName"), item: `${SITE_URL}${PATH}` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}${PATH}#faq`,
        inLanguage: currentBcp47,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FeatureLanding
        content={content}
        screenshot={
          <AnalyticsHeroShot
            labels={{
              kpis: [
                { label: t("shot.kpi1Label"), value: t("shot.kpi1Value"), delta: t("shot.kpi1Delta") },
                { label: t("shot.kpi2Label"), value: t("shot.kpi2Value"), delta: t("shot.kpi2Delta") },
                { label: t("shot.kpi3Label"), value: t("shot.kpi3Value"), delta: t("shot.kpi3Delta") },
              ],
              funnelTitle: t("shot.funnelTitle"),
              funnel: [
                { label: t("shot.funnel1Label"), count: 34 },
                { label: t("shot.funnel2Label"), count: 21 },
                { label: t("shot.funnel3Label"), count: 7 },
                { label: t("shot.funnel4Label"), count: 2 },
                { label: t("shot.funnel5Label"), count: 1 },
              ],
            }}
          />
        }
        frameLabel="lightrole.com/product/analytics"
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
