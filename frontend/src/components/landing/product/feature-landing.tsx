import { FeatureCtaBand } from "./feature-cta-band";
import { FeatureFaq } from "./feature-faq";
import { FeatureHero } from "./feature-hero";
import type { FeatureIconName } from "./feature-icon";
import { FeatureSteps } from "./feature-steps";
import { FeatureSubGrid } from "./feature-sub-grid";
import { FeatureTestimonial } from "./feature-testimonial";

export interface FeatureStepItem {
  title: string;
  body: string;
}

export interface FeatureSubItem {
  icon: FeatureIconName;
  title: string;
  body: string;
}

export interface FeatureTestimonialContent {
  quote: string;
  name: string;
  role: string;
  /** Raw color for the avatar chip (design fixes these, e.g. "#FFC9D9"). */
  avatarColor: string;
  initials: string;
}

export interface FeatureFaqItem {
  question: string;
  answer: string;
}

export interface FeatureLandingContent {
  eyebrow: string;
  kicker: string;
  title: string;
  titleAccent: string;
  body: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  /** Optional "How it works" section. When present it is section "01". */
  steps?: {
    kicker: string;
    title: string;
    items: FeatureStepItem[];
  };
  /** Sub-feature grid. Section "02" when steps present, else "01". */
  subFeatures: {
    kicker: string;
    title: string;
    items: FeatureSubItem[];
  };
  testimonial: FeatureTestimonialContent;
  faq: {
    kicker: string;
    title: string;
    items: FeatureFaqItem[];
  };
  cta: {
    title: string;
    subtitle: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
}

export interface FeatureLandingProps {
  content: FeatureLandingContent;
  /** The hero mockup rendered inside the DesktopFrame (one of the *-hero-shot components). */
  screenshot: React.ReactNode;
  /** URL-like label shown in the DesktopFrame chrome, e.g. "lightrole.com/resume-tailor". */
  frameLabel: string;
  isAuthenticated: boolean;
}

export function FeatureLanding({
  content,
  screenshot,
  frameLabel,
  isAuthenticated,
}: FeatureLandingProps) {
  return (
    <>
      <FeatureHero
        eyebrow={content.eyebrow}
        kicker={content.kicker}
        title={content.title}
        titleAccent={content.titleAccent}
        body={content.body}
        ctaPrimaryLabel={content.ctaPrimaryLabel}
        ctaSecondaryLabel={content.ctaSecondaryLabel}
        screenshot={screenshot}
        frameLabel={frameLabel}
        isAuthenticated={isAuthenticated}
      />

      {content.steps && (
        <FeatureSteps
          num="1"
          kicker={content.steps.kicker}
          title={content.steps.title}
          items={content.steps.items}
        />
      )}

      <FeatureSubGrid
        num={content.steps ? "2" : "1"}
        kicker={content.subFeatures.kicker}
        title={content.subFeatures.title}
        items={content.subFeatures.items}
      />

      <FeatureTestimonial {...content.testimonial} />

      <FeatureFaq
        kicker={content.faq.kicker}
        title={content.faq.title}
        items={content.faq.items}
      />

      <FeatureCtaBand
        title={content.cta.title}
        subtitle={content.cta.subtitle}
        primaryLabel={content.cta.primaryLabel}
        secondaryLabel={content.cta.secondaryLabel}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
