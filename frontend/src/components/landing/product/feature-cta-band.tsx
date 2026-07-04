import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/landing/chrome/container";
import { Button } from "@/components/ui/button";

export interface FeatureCtaBandProps {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  isAuthenticated: boolean;
}

export function FeatureCtaBand({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  isAuthenticated,
}: FeatureCtaBandProps) {
  const primaryHref = isAuthenticated ? "/dashboard" : "/auth/register";

  return (
    <section className="py-24 bg-[var(--color-card)] border-t border-[var(--color-border)]">
      <Container>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 p-10 md:px-12 border border-[var(--color-border)] rounded-[14px] bg-[var(--color-background)]">
          <div>
            <h3 className="m-0 font-display text-[32px] font-bold tracking-[-0.03em] leading-[1.1] text-[var(--color-foreground)]">
              {title}
            </h3>
            <p className="mt-2 m-0 font-body text-[16px] text-[var(--color-muted-fg)]">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/pricing">{secondaryLabel}</Link>
            </Button>
            <Button asChild>
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
