import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BracketTag } from "@/components/landing/chrome/bracket-tag";
import { Container } from "@/components/landing/chrome/container";
import { DesktopFrame } from "@/components/landing/sections/hero/desktop-frame";
import { Button } from "@/components/ui/button";

export interface FeatureHeroProps {
  eyebrow: string;
  kicker: string;
  title: string;
  titleAccent: string;
  body: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  screenshot: React.ReactNode;
  frameLabel: string;
  isAuthenticated: boolean;
}

export function FeatureHero({
  eyebrow,
  kicker,
  title,
  titleAccent,
  body,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  screenshot,
  frameLabel,
  isAuthenticated,
}: FeatureHeroProps) {
  const primaryHref = isAuthenticated ? "/dashboard" : "/auth/register";

  return (
    <section className="pt-20 pb-24">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <BracketTag label={eyebrow} />
            <div className="mt-[18px] font-mono text-[13px] tracking-[0.08em] uppercase text-[var(--color-primary)]">
              {kicker}
            </div>
            <h1 className="mt-4 m-0 font-display font-bold tracking-[-0.04em] leading-[1.02] text-[clamp(44px,5.5vw,76px)] text-[var(--color-foreground)]">
              {title}{" "}
              <span className="text-[var(--color-primary)]">{titleAccent}</span>
            </h1>
            <p className="mt-6 m-0 max-w-[520px] font-body text-[19px] leading-[1.55] text-[var(--color-muted-fg)]">
              {body}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href={primaryHref}>
                  {ctaPrimaryLabel}
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">{ctaSecondaryLabel}</Link>
              </Button>
            </div>
          </div>
          <div>
            <DesktopFrame label={frameLabel} heightClassName="h-[400px] lg:h-[520px]">
              {screenshot}
            </DesktopFrame>
          </div>
        </div>
      </Container>
    </section>
  );
}
