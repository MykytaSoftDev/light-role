import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";
import { FaqAccordion } from "@/components/landing/sections/faq-accordion";

import type { FeatureFaqItem } from "./feature-landing";

export interface FeatureFaqProps {
  kicker: string;
  title: string;
  items: FeatureFaqItem[];
}

export function FeatureFaq({ kicker, title, items }: FeatureFaqProps) {
  const accordionItems = items.map((it, i) => ({
    id: `q${i + 1}`,
    question: it.question,
    answer: it.answer,
  }));

  return (
    <section className="py-24">
      <Container narrow>
        <SectionHead kicker={kicker} title={title} />
        <div className="mt-14">
          <FaqAccordion items={accordionItems} />
        </div>
      </Container>
    </section>
  );
}
