import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/landing/chrome/container";
import { getAuthState } from "@/lib/auth/get-auth-state";

export async function BigCta() {
  const t = await getTranslations("Marketing.landing.bigCta");
  const { isAuthenticated } = await getAuthState();

  const ctaHref = isAuthenticated ? "/dashboard" : "/auth/register";
  const ctaLabel = isAuthenticated ? t("ctaPrimaryAuthed") : t("ctaPrimary");
  const ctaMeta = isAuthenticated ? t("ctaPrimaryMetaAuthed") : t("ctaPrimaryMeta");

  return (
    <section
      className="py-24 border-t border-[var(--color-border)] bg-[var(--color-background)]"
      aria-labelledby="big-cta-heading"
    >
      <Container>
        <div className="relative overflow-hidden rounded-[20px] bg-[var(--color-foreground)] text-[var(--color-background)] p-14 md:px-18 md:py-14 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 md:items-center">
          <div
            aria-hidden="true"
            className="absolute -top-[30px] -left-[30px] size-[140px] opacity-[0.12]"
          >
            <svg viewBox="0 0 200 200" fill="none" width="100%" height="100%">
              <path
                d="M 60 32 L 32 32 L 32 168 L 60 168"
                stroke="var(--color-primary)"
                strokeWidth="16"
                fill="none"
              />
            </svg>
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-[40px] -right-[30px] size-[160px] opacity-[0.12]"
          >
            <svg viewBox="0 0 200 200" fill="none" width="100%" height="100%">
              <path
                d="M 140 32 L 168 32 L 168 168 L 140 168"
                stroke="var(--color-primary)"
                strokeWidth="16"
                fill="none"
              />
            </svg>
          </div>
          <div className="relative z-[1]">
            <h2
              id="big-cta-heading"
              className="m-0 font-display text-[clamp(36px,6vw,56px)] font-bold tracking-[-0.04em] leading-[1.02]"
            >
              {t.rich("heading", {
                highlight: (chunks) => (
                  <span className="text-[var(--color-primary)]">{chunks}</span>
                ),
              })}
            </h2>
            <p className="mt-5 max-w-[480px] font-body text-[17px] leading-[1.5] opacity-80">
              {t("body")}
            </p>
          </div>
          {/* Bespoke action row: shadcn Button doesn't model a right-aligned meta chip pattern, so we hand-build the link. */}
          <div className="relative z-[1] flex flex-col gap-3.5">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-between px-7 py-[22px] rounded-[12px] bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-display text-[18px] font-semibold tracking-[-0.015em] no-underline hover:opacity-95 transition-opacity"
            >
              <span>{ctaLabel}</span>
              {ctaMeta && (
                <span className="font-mono text-[12px] tracking-[0.1em] opacity-70">
                  {ctaMeta}
                </span>
              )}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
