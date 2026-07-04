import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  FeatureLanding,
  type FeatureLandingContent,
} from "@/components/landing/product/feature-landing";
import type { FeatureIconName } from "@/components/landing/product/feature-icon";
import { KanbanHeroShot } from "@/components/landing/product/shots/kanban-hero-shot";
import { getAuthState } from "@/lib/auth/get-auth-state";
import {
  buildProductMetadata,
  LOCALE_BCP47,
  SITE_URL,
} from "@/lib/seo/marketing-seo";

const PATH = "/product/job-tracking";
const KEYWORDS = [
  "job application tracker",
  "job search kanban board",
  "application pipeline tracker",
  "job tracking spreadsheet alternative",
  "follow-up reminders job search",
];
const FEATURE_ICONS: FeatureIconName[] = ["columns", "bell", "clock", "target", "funnel", "spark"];
const FEATURE_IDS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const FAQ_IDS = ["q1", "q2", "q3"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.product.jobTracking");
  const locale = await getLocale();
  return buildProductMetadata({
    locale,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: KEYWORDS,
    path: PATH,
  });
}

export default async function JobTrackingPage() {
  const t = await getTranslations("Marketing.product.jobTracking");
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
      name: "Yuki Tanaka",
      role: t("testimonial.role"),
      avatarColor: "#E5D6FF",
      initials: "YT",
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
          <KanbanHeroShot
            labels={{
              columns: [
                { label: t("shot.colSaved"), count: 12 },
                { label: t("shot.colApplied"), count: 8 },
                { label: t("shot.colInterview"), count: 3 },
                { label: t("shot.colOffer"), count: 1 },
              ],
            }}
          />
        }
        frameLabel="lightrole.com/product/job-tracking"
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
