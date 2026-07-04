import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";

import type { FeatureStepItem } from "./feature-landing";

export interface FeatureStepsProps {
  num: string;
  kicker: string;
  title: string;
  items: FeatureStepItem[];
}

const COL_CLASS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function FeatureSteps({ num, kicker, title, items }: FeatureStepsProps) {
  const colClass = COL_CLASS[items.length] ?? "md:grid-cols-3";

  return (
    <section className="py-24 bg-[var(--color-card)] border-t border-[var(--color-border)]">
      <Container>
        <SectionHead num={num} kicker={kicker} title={title} />
        <div
          className={`mt-16 grid grid-cols-1 ${colClass} border border-[var(--color-border)] rounded-[14px] overflow-hidden bg-[var(--color-background)]`}
        >
          {items.map((s, i) => (
            <div
              key={i}
              className={`p-8 md:p-10 bg-[var(--color-background)] flex flex-col gap-3.5 min-h-[240px] ${
                i < items.length - 1
                  ? "border-b md:border-b-0 md:border-r border-[var(--color-border)]"
                  : ""
              }`}
            >
              <div className="font-display text-[56px] font-bold tracking-[-0.05em] leading-none text-[var(--color-primary)]">
                {String(i + 1).padStart(2, "0")}
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
