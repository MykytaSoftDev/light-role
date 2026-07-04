import { Container } from "@/components/landing/chrome/container";

import type { FeatureTestimonialContent } from "./feature-landing";

export type FeatureTestimonialProps = FeatureTestimonialContent;

export function FeatureTestimonial({
  quote,
  name,
  role,
  avatarColor,
  initials,
}: FeatureTestimonialProps) {
  return (
    <section className="py-16">
      <Container narrow>
        <div className="border border-[var(--color-border)] rounded-[14px] bg-[var(--color-card)] px-8 py-10 md:px-14 md:py-12 flex flex-col gap-5">
          <div
            aria-hidden="true"
            className="font-display text-[60px] leading-none font-bold text-[var(--color-primary)] h-[22px]"
          >
            &ldquo;
          </div>
          <p className="m-0 font-display text-[22px] md:text-2xl font-medium tracking-[-0.02em] leading-[1.4] text-[var(--color-foreground)]">
            {quote}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <div
              className="size-[42px] rounded-full flex items-center justify-center font-display font-bold text-[14px] tracking-[-0.02em] text-[#2a251f]"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <div className="font-display text-[15px] font-semibold text-[var(--color-foreground)]">
                {name}
              </div>
              <div className="font-body text-[13px] text-[var(--color-muted-fg)]">{role}</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
