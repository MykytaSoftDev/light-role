import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  FeatureLanding,
  type FeatureLandingContent,
} from "@/components/landing/product/feature-landing";
import type { FeatureIconName } from "@/components/landing/product/feature-icon";
import { TailorHeroShot } from "@/components/landing/product/shots/tailor-hero-shot";
import { getAuthState } from "@/lib/auth/get-auth-state";
import {
  buildProductMetadata,
  LOCALE_BCP47,
  SITE_URL,
} from "@/lib/seo/marketing-seo";

const PATH = "/product/resume-tailor";
const KEYWORDS = [
  "AI resume tailoring",
  "resume keyword matching",
  "ATS resume builder",
  "tailor resume to job description",
  "resume optimization",
];
const FEATURE_ICONS: FeatureIconName[] = ["target", "swap", "shield", "sparkle", "layers", "bolt"];
const FEATURE_IDS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const STEP_IDS = ["step1", "step2", "step3"] as const;
const FAQ_IDS = ["q1", "q2", "q3", "q4"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.product.resumeTailor");
  const locale = await getLocale();
  return buildProductMetadata({
    locale,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: KEYWORDS,
    path: PATH,
  });
}

export default async function ResumeTailorPage() {
  const t = await getTranslations("Marketing.product.resumeTailor");
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
    steps: {
      kicker: tShared("howItWorksKicker"),
      title: tShared("howItWorksTitle"),
      items: STEP_IDS.map((id) => ({
        title: t(`steps.${id}.title`),
        body: t(`steps.${id}.body`),
      })),
    },
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
      name: "Maya Chen",
      role: t("testimonial.role"),
      avatarColor: "#FFC9D9",
      initials: "MC",
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
          <TailorHeroShot
            labels={{
              jobTitle: t("shot.jobTitle"),
              downloadPdf: t("shot.downloadPdf"),
              summaryLabel: t("shot.summaryLabel"),
              experienceLabel: t("shot.experienceLabel"),
              insightsTitle: t("shot.insightsTitle"),
              matchedKeywordsTitle: t("shot.matchedKeywordsTitle"),
              appliedChangesTitle: t("shot.appliedChangesTitle"),
              matchedKeywords: [
                t("shot.matchedKeyword1"),
                t("shot.matchedKeyword2"),
                t("shot.matchedKeyword3"),
                t("shot.matchedKeyword4"),
              ],
              appliedSections: [t("shot.appliedSection1"), t("shot.appliedSection2")],
              untouchedSections: [t("shot.untouchedSection1"), t("shot.untouchedSection2")],
            }}
          />
        }
        frameLabel="lightrole.com/product/resume-tailor"
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
