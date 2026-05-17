import { getTranslations } from "next-intl/server";
import {
  siApple,
  siFigma,
  siGithub,
  siGoogle,
  siLinear,
  siMeta,
  siNetflix,
  siNotion,
  siShopify,
  siSpotify,
  siStripe,
  siVercel,
} from "simple-icons/icons";

import { Container } from "@/components/landing/chrome/container";

type SimpleIconData = { title: string; path: string };

function BrandLogo({
  icon,
  className,
  ariaHidden,
}: {
  icon: SimpleIconData;
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={ariaHidden ? undefined : icon.title}
      aria-hidden={ariaHidden ? "true" : undefined}
      className={className}
      fill="currentColor"
    >
      <path d={icon.path} />
    </svg>
  );
}

export async function LogosStrip() {
  const t = await getTranslations("Marketing.landing.logosStrip");

  const brands: SimpleIconData[] = [
    siGoogle,
    siMeta,
    siApple,
    siGithub,
    siSpotify,
    siNetflix,
    siStripe,
    siLinear,
    siNotion,
    siVercel,
    siShopify,
    siFigma,
  ];

  const loop = [...brands, ...brands];

  return (
    <section
      aria-label={t("label")}
      className="py-14 border-y border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <Container>
        <div className="flex flex-col gap-8">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--color-muted-fg)] text-center">
            {t("label")}
          </div>
          <div className="overflow-hidden w-full">
            <div className="flex items-center gap-12 w-max animate-[lr-marquee_30s_linear_infinite] hover:[animation-play-state:paused]">
              {loop.map((brand, i) => (
                <BrandLogo
                  key={`${brand.title}-${i}`}
                  icon={brand}
                  ariaHidden={i >= brands.length}
                  className="h-7 w-auto shrink-0 text-[var(--color-muted-fg)] opacity-70"
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
