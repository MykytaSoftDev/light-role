import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Logo } from "@/components/landing/brand/logo";

import { Container } from "./container";
import { MonoTag } from "./mono-tag";

interface FooterLink {
  label: string;
  href: string;
  disabled: boolean;
}

export async function Footer() {
  const t = await getTranslations("Marketing.chrome.footer");
  const year = new Date().getFullYear();

  const productLinks: FooterLink[] = [
    { label: t("linkPricing"), href: "/pricing", disabled: false },
    { label: t("linkResumeTailor"), href: "#", disabled: true },
    { label: t("linkCoverLetters"), href: "#", disabled: true },
    { label: t("linkJobTracking"), href: "#", disabled: true },
    { label: t("linkAnalytics"), href: "#", disabled: true },
    { label: t("linkTemplates"), href: "#", disabled: true },
    { label: t("linkChangelog"), href: "#", disabled: true },
  ];
  const resourceLinks: FooterLink[] = [
    { label: t("linkBlog"), href: "#", disabled: true },
    { label: t("linkHelpCenter"), href: "#", disabled: true },
    { label: t("linkResumeGuides"), href: "#", disabled: true },
    { label: t("linkApiStatus"), href: "#", disabled: true },
    { label: t("linkRoadmap"), href: "#", disabled: true },
  ];
  const companyLinks: FooterLink[] = [
    { label: t("linkAbout"), href: "#", disabled: true },
    { label: t("linkCareers"), href: "#", disabled: true },
    { label: t("linkContact"), href: "#", disabled: true },
    { label: t("linkPressKit"), href: "#", disabled: true },
  ];
  const legalLinks: FooterLink[] = [
    { label: t("linkTerms"), href: "/terms-and-conditions", disabled: false },
    { label: t("linkPrivacy"), href: "/privacy-policy", disabled: false },
    { label: t("linkCookiePolicy"), href: "#", disabled: true },
    { label: t("linkGdpr"), href: "#", disabled: true },
    { label: t("linkDpa"), href: "#", disabled: true },
  ];

  const columns: { title: string; links: FooterLink[] }[] = [
    { title: t("columnTitleProduct"), links: productLinks },
    { title: t("columnTitleResources"), links: resourceLinks },
    { title: t("columnTitleCompany"), links: companyLinks },
    { title: t("columnTitleLegal"), links: legalLinks },
  ];

  const socials: { key: "X" | "in" | "GH"; label: string }[] = [
    { key: "X", label: t("socialX") },
    { key: "in", label: t("socialIn") },
    { key: "GH", label: t("socialGh") },
  ];

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-background)] pt-20 pb-12">
      <Container>
        <div className="mb-16 grid gap-12 grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center no-underline">
              <Logo size={28} />
            </Link>
            <p className="mt-[18px] font-body text-sm leading-[1.5] text-[var(--color-muted-fg)] max-w-[280px]">
              {t("tagline")}
            </p>
            <div className="mt-6 flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href="#"
                  aria-disabled="true"
                  aria-label={s.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] font-mono text-[11px] font-semibold text-[var(--color-muted-fg)] no-underline pointer-events-none"
                >
                  {s.key}
                </a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <MonoTag className="block mb-[18px] font-semibold">{col.title}</MonoTag>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.disabled ? (
                      <a
                        href="#"
                        aria-disabled="true"
                        className="font-display text-sm font-medium text-[var(--color-foreground)] no-underline cursor-default pointer-events-none opacity-90"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="font-display text-sm font-medium text-[var(--color-foreground)] no-underline hover:text-[var(--color-primary)]"
                      >
                        {l.label}
                      </Link>
                    )}
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
