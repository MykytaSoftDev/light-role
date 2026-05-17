import { getTranslations } from "next-intl/server";

import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";

import { FaqAccordion } from "./faq-accordion";

export async function Faq() {
  const t = await getTranslations("Marketing.landing.faq");

  const items = Array.from({ length: 6 }, (_, i) => {
    const id = `q${i + 1}`;
    return {
      id,
      question: t(`${id}.question`),
      answer: t(`${id}.answer`),
    };
  });

  return (
    <section className="py-32 bg-[var(--color-background)]" aria-labelledby="faq-heading">
      <Container narrow>
        <SectionHead
          num="05"
          kicker={t("sectionKicker")}
          title={t("sectionTitle")}
          headingId="faq-heading"
        />
        <div className="mt-14">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </section>
  );
}
