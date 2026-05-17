import { getTranslations } from "next-intl/server";

import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";

export async function HowItWorks() {
  const t = await getTranslations("Marketing.landing.howItWorks");

  const steps = [
    {
      n: 1,
      title: t("step1Title"),
      body: t("step1Body"),
      meta: t("step1Meta"),
    },
    {
      n: 2,
      title: t("step2Title"),
      body: t("step2Body"),
      meta: t("step2Meta"),
    },
    {
      n: 3,
      title: t("step3Title"),
      body: t("step3Body"),
      meta: t("step3Meta"),
    },
  ];

  return (
    <section className="py-32 bg-[var(--color-background)]" aria-labelledby="how-it-works-heading">
      <Container>
        <SectionHead
          num="1"
          kicker={t("sectionKicker")}
          title={t("sectionTitle")}
          sub={t("sectionSub")}
          headingId="how-it-works-heading"
        />
        <div className="mt-[72px] grid grid-cols-1 md:grid-cols-3 border border-[var(--color-border)] rounded-[14px] overflow-hidden bg-[var(--color-background)]">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`p-8 md:p-10 bg-[var(--color-card)] flex flex-col gap-3.5 min-h-[280px] ${
                i < steps.length - 1
                  ? "border-b md:border-b-0 md:border-r border-[var(--color-border)]"
                  : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-[60px] font-bold tracking-[-0.05em] leading-none text-[var(--color-primary)]">
                  0{s.n}
                </div>
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-[var(--color-muted-fg)]">
                  {s.meta}
                </span>
              </div>
              <h3 className="m-0 font-display text-[22px] font-bold tracking-[-0.02em] leading-[1.2] text-[var(--color-foreground)]">
                {s.title}
              </h3>
              <p className="m-0 font-body text-[15px] leading-[1.55] text-[var(--color-muted-fg)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
