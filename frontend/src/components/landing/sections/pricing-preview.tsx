import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BracketTag } from "@/components/landing/chrome/bracket-tag";
import { Container } from "@/components/landing/chrome/container";

import { PlanCard } from "./plan-card";

export async function PricingPreview() {
  const t = await getTranslations("Marketing.landing.pricingPreview");

  return (
    <section
      className="py-32 border-t border-[var(--color-border)] bg-[var(--color-card)]"
      aria-labelledby="pricing-preview-heading"
    >
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 md:items-end mb-14">
          <div className="flex flex-col gap-[18px]">
            <BracketTag num="04" label={t("sectionKicker")} />
            <h2
              id="pricing-preview-heading"
              className="m-0 font-display text-[48px] font-bold tracking-[-0.035em] leading-[1.05] text-[var(--color-foreground)] whitespace-pre-line"
            >
              {t("sectionTitle")}
            </h2>
          </div>
          <p className="m-0 max-w-[560px] font-body text-[18px] leading-[1.55] text-[var(--color-muted-fg)] pb-3">
            {t("sectionSub")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          <PlanCard
            name={t("planFreeName")}
            price={t("planFreePrice")}
            priceSuffix={t("planFreePriceSuffix")}
            description={t("planFreeDescription")}
            ctaLabel={t("planFreeCta")}
            ctaHref="/auth/register"
            ctaVariant="outline"
          />
          <PlanCard
            name={t("planProName")}
            price={t("planProPrice")}
            priceSuffix={t("planProPriceSuffix")}
            description={t("planProDescription")}
            ctaLabel={t("planProCta")}
            ctaHref="/auth/register?plan=pro"
            ctaVariant="default"
            featured
            featuredLabel={t("mostPopular")}
          />
          <PlanCard
            name={t("planUnlimitedName")}
            price={t("planUnlimitedPrice")}
            priceSuffix={t("planUnlimitedPriceSuffix")}
            description={t("planUnlimitedDescription")}
            ctaLabel={t("planUnlimitedCta")}
            ctaHref="/auth/register?plan=unlimited"
            ctaVariant="outline"
          />
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/pricing#compare"
            className="inline-flex items-center gap-1.5 font-display text-[14px] font-medium text-[var(--color-foreground)] border-b border-[var(--color-foreground)] pb-0.5"
          >
            {t("compareLink")}
          </Link>
        </div>
      </Container>
    </section>
  );
}
