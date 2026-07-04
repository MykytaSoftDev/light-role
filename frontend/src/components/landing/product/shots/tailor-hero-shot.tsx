import { Check, Download } from "lucide-react";

import { KwInline } from "@/components/landing/sections/hero/kw-inline";

export interface TailorHeroShotLabels {
  /** Job the resume is tailored to, shown in the editor header. */
  jobTitle: string;
  downloadPdf: string;
  summaryLabel: string;
  experienceLabel: string;
  insightsTitle: string;
  matchedKeywordsTitle: string;
  appliedChangesTitle: string;
  /** Keyword chips shown in the Insights panel. */
  matchedKeywords: string[];
  /** Sections the AI touched (rendered as checked, primary rows). */
  appliedSections: string[];
  /** Sections left untouched (rendered as plain, muted rows). */
  untouchedSections: string[];
}

interface TailorHeroShotProps {
  labels: TailorHeroShotLabels;
}

// Fictional candidate content. Only the section labels + insight strings are
// translatable (via labels); the résumé prose itself stays constant.
const NAVY = "oklch(25% 0.05 264)";

export function TailorHeroShot({ labels }: TailorHeroShotProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-secondary)] font-display">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="min-w-0 text-[13px] font-bold tracking-[-0.02em] text-[var(--color-foreground)] whitespace-nowrap overflow-hidden text-ellipsis">
          {labels.jobTitle}
        </div>
        <div className="flex-none inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-[var(--color-primary-fg)] text-[10.5px] font-semibold tracking-[-0.01em] whitespace-nowrap px-2.5 py-1.5 rounded-[7px]">
          <Download size={11} strokeWidth={2.4} aria-hidden="true" />
          {labels.downloadPdf}
        </div>
      </div>

      {/* Two columns */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_168px] gap-2.5 p-3">
        {/* Résumé document */}
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[9px] px-[18px] py-4 overflow-hidden">
          <div className="text-[17px] font-bold tracking-[-0.03em]" style={{ color: NAVY }}>
            Maya Lindqvist
          </div>
          <div className="font-mono text-[7.5px] text-[var(--color-muted-fg)] mt-0.5 tracking-[0.02em]">
            maya.lindqvist@gmail.com · LinkedIn · Portfolio
          </div>

          <div className="flex items-center gap-1.5 mt-3 mb-1.5">
            <span className="font-mono text-[7.5px] font-bold tracking-[0.14em] uppercase text-[var(--color-muted-fg)]">
              {labels.summaryLabel}
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="font-body text-[8.5px] leading-[1.55] text-[var(--color-foreground)]">
            Senior Product Designer fluent in{" "}
            <KwInline colorId={3}>systems thinking</KwInline> and{" "}
            <KwInline colorId={1}>design tokens</KwInline>, shipping coherent{" "}
            <KwInline colorId={5}>SaaS</KwInline> products across web and mobile.
          </div>

          <div className="flex items-center gap-1.5 mt-3 mb-1.5">
            <span className="font-mono text-[7.5px] font-bold tracking-[0.14em] uppercase text-[var(--color-muted-fg)]">
              {labels.experienceLabel}
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="flex justify-between items-baseline gap-2">
            <div className="text-[10px] font-bold tracking-[-0.01em] whitespace-nowrap text-[var(--color-foreground)]">
              Senior Product Designer
            </div>
            <div className="font-mono text-[7px] text-[var(--color-muted-fg)] whitespace-nowrap">
              2022 – Now
            </div>
          </div>
          <div className="text-[9px] font-medium text-[var(--color-foreground)] mt-0.5">
            Linear · Remote (EU)
          </div>
          <div className="text-[8.5px] leading-[1.5] text-[var(--color-muted-fg)] mt-1.5">
            Led the redesign of the core view used by 500k+ teams, lifting weekly active usage by
            18%.
          </div>
          <div className="text-[8.5px] leading-[1.5] text-[var(--color-muted-fg)] mt-1">
            Built the <KwInline colorId={1}>design-token</KwInline> system unifying web and mobile,
            cutting handoff time 30%.
          </div>
        </div>

        {/* Insights panel */}
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[9px] p-[13px] flex flex-col gap-2.5 overflow-hidden">
          <div className="text-[11.5px] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
            {labels.insightsTitle}
          </div>

          <div>
            <div className="text-[8.5px] font-semibold tracking-[-0.01em] mb-1.5 text-[var(--color-foreground)]">
              {labels.matchedKeywordsTitle}
            </div>
            <div className="flex flex-wrap gap-1">
              {labels.matchedKeywords.map((k) => (
                <span
                  key={k}
                  className="font-mono text-[7.5px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] leading-[1.3]"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          <div>
            <div className="text-[8.5px] font-semibold tracking-[-0.01em] mb-1.5 text-[var(--color-foreground)]">
              {labels.appliedChangesTitle}
            </div>
            <div className="flex flex-col gap-1">
              {labels.appliedSections.map((c) => (
                <div
                  key={c}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[var(--color-primary-10)] border border-[var(--color-primary-20)]"
                >
                  <Check size={10} className="text-[var(--color-primary)]" aria-hidden="true" />
                  <span className="text-[8.5px] font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
                    {c}
                  </span>
                </div>
              ))}
              {labels.untouchedSections.map((c) => (
                <div
                  key={c}
                  className="flex items-center px-2 py-1.5 rounded-md bg-[var(--color-background)] border border-[var(--color-border)]"
                >
                  <span className="text-[8.5px] font-medium tracking-[-0.01em] text-[var(--color-muted-fg)]">
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
