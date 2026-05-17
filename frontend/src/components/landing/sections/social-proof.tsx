import { getTranslations } from "next-intl/server";

import { BracketTag } from "@/components/landing/chrome/bracket-tag";
import { Container } from "@/components/landing/chrome/container";

import { BigStat } from "./big-stat";
import { TestimonialCard } from "./testimonial-card";

const TESTIMONIAL_AVATARS = [
  { initials: "MK", avatarBgClassName: "bg-[#FFE4B5]" },
  { initials: "AS", avatarBgClassName: "bg-[#B5E5CF]" },
  { initials: "JT", avatarBgClassName: "bg-[#FFD1DC]" },
  { initials: "RV", avatarBgClassName: "bg-[#C5CAE9]" },
  { initials: "DP", avatarBgClassName: "bg-[#FFF3B0]" },
  { initials: "LK", avatarBgClassName: "bg-[#D4C5F9]" },
] as const;

export async function SocialProof() {
  const t = await getTranslations("Marketing.landing.socialProof");

  const testimonials = TESTIMONIAL_AVATARS.map((avatar, i) => {
    const key = `testimonial${i + 1}` as const;
    return {
      ...avatar,
      quote: t(`${key}.quote`),
      name: t(`${key}.name`),
      role: t(`${key}.role`),
    };
  });

  return (
    <section className="py-32 bg-[var(--color-background)]" aria-labelledby="social-proof-heading">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 md:items-end mb-16">
          <div className="flex flex-col gap-[18px]">
            <BracketTag num="03" label={t("sectionKicker")} />
            <h2
              id="social-proof-heading"
              className="m-0 font-display text-[48px] font-bold tracking-[-0.035em] leading-[1.05] text-[var(--color-foreground)] whitespace-pre-line"
            >
              {t("sectionTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pb-3">
            <BigStat value={t("stat1Value")} label={t("stat1Label")} />
            <BigStat value={t("stat2Value")} label={t("stat2Label")} />
            <BigStat value={t("stat3Value")} label={t("stat3Label")} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {testimonials.map((item, i) => (
            <TestimonialCard
              key={i}
              quote={item.quote}
              name={item.name}
              role={item.role}
              initials={item.initials}
              avatarBgClassName={item.avatarBgClassName}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
