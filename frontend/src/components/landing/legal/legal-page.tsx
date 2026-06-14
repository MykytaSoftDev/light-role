import { Container } from "@/components/landing/chrome/container";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface LegalPageProps {
  /** Page title — may contain a newline to break onto two lines. */
  title: string;
  /** Human-readable last-updated date, e.g. "June 10, 2026". */
  lastUpdated: string;
  /** TL;DR callout body (the "TL;DR" prefix is rendered separately). */
  tldr: string;
  sections: LegalSection[];
}

/** Two-digit section number derived from array index (01, 02, …). */
function sectionNum(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * Shared server component for the public legal pages (Terms, Privacy).
 * English-only by design — no i18n. The two route pages just pass data.
 */
export function LegalPage({ title, lastUpdated, tldr, sections }: LegalPageProps) {
  return (
    <section className="bg-[var(--color-background)] py-20 lg:py-24">
      <Container className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
        {/* Sidebar: title + table of contents */}
        <aside className="mb-14 lg:mb-0 lg:sticky lg:top-24 lg:self-start">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">
            <span className="text-[var(--color-primary)]">[</span>
            {" LEGAL "}
            <span className="text-[var(--color-primary)]">]</span>
          </span>

          <h1 className="mt-5 m-0 font-display text-[40px] font-bold tracking-[-0.035em] leading-[1.05] text-[var(--color-foreground)] whitespace-pre-line lg:text-[44px]">
            {title}
          </h1>

          <p className="mt-4 font-mono text-xs text-[var(--color-muted-fg)]">
            Last updated: {lastUpdated}
          </p>

          <div className="mt-8 border-t border-[var(--color-border)] pt-6">
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted-fg)]">
              Contents
            </p>
            <nav aria-label="Table of contents" className="mt-4">
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                {sections.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="group flex items-baseline gap-3 text-sm text-[var(--color-muted-fg)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      <span className="font-mono text-xs text-[var(--color-muted-fg)] transition-colors group-hover:text-[var(--color-primary)]">
                        {sectionNum(i)}
                      </span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="max-w-[720px]">
          {/* TL;DR callout */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-5 sm:p-6">
            <p className="m-0 font-body text-[15px] leading-relaxed text-[var(--color-foreground)]">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                TL;DR
              </span>{" "}
              {tldr}
            </p>
          </div>

          <div className="mt-14">
            {sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-24 mb-14 last:mb-0"
              >
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="font-mono text-sm font-medium text-[var(--color-primary)]">
                    {sectionNum(i)}
                  </span>
                  <h2
                    id={`${section.id}-heading`}
                    className="m-0 font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]"
                  >
                    {section.title}
                  </h2>
                </div>
                <div className="flex flex-col gap-4">
                  {section.paragraphs.map((paragraph, p) => (
                    <p
                      key={p}
                      className="m-0 font-body text-[15px] leading-relaxed text-[var(--color-muted-fg)]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
