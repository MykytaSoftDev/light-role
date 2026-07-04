import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  FeatureLanding,
  type FeatureLandingContent,
} from "@/components/landing/product/feature-landing";
import type { FeatureIconName } from "@/components/landing/product/feature-icon";
import { CoverLetterHeroShot } from "@/components/landing/product/shots/cover-letter-hero-shot";
import { getAuthState } from "@/lib/auth/get-auth-state";
import {
  buildProductMetadata,
  LOCALE_BCP47,
  SITE_URL,
} from "@/lib/seo/marketing-seo";

const PATH = "/product/cover-letters";
const KEYWORDS = [
  "AI cover letter generator",
  "personalized cover letter",
  "cover letter tone control",
  "multilingual cover letters",
  "cover letter from job description",
];
const FEATURE_ICONS: FeatureIconName[] = ["sparkle", "pencil", "layers"];
const FEATURE_IDS = ["f1", "f2", "f3"] as const;
const FAQ_IDS = ["q1", "q2", "q3"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.product.coverLetters");
  const locale = await getLocale();
  return buildProductMetadata({
    locale,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: KEYWORDS,
    path: PATH,
  });
}

export default async function CoverLettersPage() {
  const t = await getTranslations("Marketing.product.coverLetters");
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
      name: "Jordan Reyes",
      role: t("testimonial.role"),
      avatarColor: "#FFE4B0",
      initials: "JR",
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
          <CoverLetterHeroShot
            labels={{
              style: {
                options: [t("shot.styleOption1"), t("shot.styleOption2"), t("shot.styleOption3")],
                activeIndex: 1,
              },
              tone: {
                options: [t("shot.toneOption1"), t("shot.toneOption2"), t("shot.toneOption3")],
                activeIndex: 0,
              },
              length: {
                options: [t("shot.lengthOption1"), t("shot.lengthOption2"), t("shot.lengthOption3")],
                activeIndex: 1,
              },
              draftLabel: t("shot.draftLabel"),
              greeting: t("shot.greeting"),
              body1Pre: t("shot.body1Pre"),
              body1Highlight: t("shot.body1Highlight"),
              body1Post: t("shot.body1Post"),
              body2Pre: t("shot.body2Pre"),
              body2Highlight: t("shot.body2Highlight"),
              body2Post: t("shot.body2Post"),
              signoff: t("shot.signoff"),
              name: t("shot.name"),
            }}
          />
        }
        frameLabel="lightrole.com/product/cover-letters"
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
