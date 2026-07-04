import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";

import { FeatureIcon } from "./feature-icon";
import type { FeatureSubItem } from "./feature-landing";

export interface FeatureSubGridProps {
  num: string;
  kicker: string;
  title: string;
  items: FeatureSubItem[];
}

export function FeatureSubGrid({ num, kicker, title, items }: FeatureSubGridProps) {
  return (
    <section className="py-24">
      <Container>
        <SectionHead num={num} kicker={kicker} title={title} />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {items.map((it, i) => (
            <div
              key={i}
              className="p-7 border border-[var(--color-border)] rounded-[14px] bg-[var(--color-card)] flex flex-col gap-3.5"
            >
              <div className="size-[42px] rounded-[10px] bg-[var(--color-primary-10)] text-[var(--color-primary)] inline-flex items-center justify-center">
                <FeatureIcon name={it.icon} />
              </div>
              <h3 className="m-0 font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
                {it.title}
              </h3>
              <p className="m-0 font-body text-[14.5px] leading-[1.55] text-[var(--color-muted-fg)]">
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
