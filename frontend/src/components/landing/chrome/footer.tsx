import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Logo } from "@/components/landing/brand/logo";

import { Container } from "./container";
import { MonoTag } from "./mono-tag";

interface FooterLink {
  label: string;
  href: string;
}

export async function Footer() {
  const t = await getTranslations("Marketing.chrome.footer");
  const year = new Date().getFullYear();

  const productLinks: FooterLink[] = [
    { label: t("linkPricing"), href: "/pricing" },
    { label: t("linkResumeTailor"), href: "/product/resume-tailor" },
    { label: t("linkCoverLetters"), href: "/product/cover-letters" },
    { label: t("linkJobTracking"), href: "/product/job-tracking" },
    { label: t("linkAnalytics"), href: "/product/analytics" },
  ];
  const legalLinks: FooterLink[] = [
    { label: t("linkTerms"), href: "/terms-and-conditions" },
    { label: t("linkPrivacy"), href: "/privacy-policy" },
  ];

  const columns: { title: string; links: FooterLink[] }[] = [
    { title: t("columnTitleProduct"), links: productLinks },
    { title: t("columnTitleLegal"), links: legalLinks },
  ];

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-background)] pt-20 pb-12">
      <Container>
        <div className="mb-16 grid gap-12 grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:2fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center no-underline">
              <Logo size={28} />
            </Link>
            <p className="mt-[18px] font-body text-sm leading-[1.5] text-[var(--color-muted-fg)] max-w-[280px]">
              {t("tagline")}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <MonoTag className="block mb-[18px] font-semibold">{col.title}</MonoTag>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="font-display text-sm font-medium text-[var(--color-foreground)] no-underline hover:text-[var(--color-primary)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center border-t border-[var(--color-border)] pt-8 font-mono text-xs text-[var(--color-muted-fg)]">
          <div>{t("copyright", { year })}</div>
        </div>
      </Container>
    </footer>
  );
}
