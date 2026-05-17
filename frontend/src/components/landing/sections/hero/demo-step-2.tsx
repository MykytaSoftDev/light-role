import { Check } from "lucide-react";

import { BracketTag } from "@/components/landing/chrome/bracket-tag";

import { KwInline } from "./kw-inline";

interface DemoStep2Props {
  active: boolean;
  title: string;
  stepLabel: string;
  personName: string;
  personEmail: string;
  summaryLabel: string;
  experienceLabel: string;
  experienceRole: string;
  bullets: string[];
  matchedLabel: string;
  matchLabel: string;
  keywords: { label: string; colorId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 }[];
  summaryParts: [string, string, string, string, string, string];
}

export function DemoStep2({
  active,
  title,
  stepLabel,
  personName,
  personEmail,
  summaryLabel,
  experienceLabel,
  experienceRole,
  bullets,
  matchedLabel,
  matchLabel,
  keywords,
  summaryParts,
}: DemoStep2Props) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 px-7 py-[22px] flex flex-col gap-3.5 transition-[opacity,transform] duration-[350ms] ${
        active ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="flex items-baseline gap-3.5">
        <BracketTag num="2" label={stepLabel} />
      </div>
      <h3 className="m-0 font-display text-[24px] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">
        {title}
      </h3>
      <div className="flex-1 min-h-0 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-3.5 grid grid-cols-[1fr_220px] gap-3.5">
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-3.5 font-display text-[11px] text-[var(--color-foreground)] overflow-hidden">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="text-[14px] font-bold tracking-[-0.02em]">{personName}</div>
            <div className="font-mono text-[9px] text-[var(--color-muted-fg)]">
              {personEmail}
            </div>
          </div>
          <div className="font-mono text-[9px] tracking-[0.1em] text-[var(--color-primary)] mt-2 mb-1 uppercase">
            {summaryLabel}
          </div>
          <div className="leading-[1.55] text-[var(--color-muted-fg)] text-[10.5px]">
            {summaryParts[0]}
            <KwInline colorId={1}>{keywords[0]?.label ?? "growth"}</KwInline>
            {summaryParts[1]}
            <KwInline colorId={3}>{keywords[1]?.label ?? "B2B SaaS"}</KwInline>
            {summaryParts[2]}
            <KwInline colorId={5}>{keywords[3]?.label ?? "onboarding"}</KwInline>
            {summaryParts[3]}
            <KwInline colorId={4}>{keywords[2]?.label ?? "Figma"}</KwInline>
            {summaryParts[4]}
            <KwInline colorId={1}>{keywords[4]?.label ?? "experimentation"}</KwInline>
            {summaryParts[5]}
          </div>
          <div className="font-mono text-[9px] tracking-[0.1em] text-[var(--color-primary)] mt-2.5 mb-1 uppercase">
            {experienceLabel}
          </div>
          <div className="font-semibold text-[11px]">{experienceRole}</div>
          <ul className="mt-1 ml-3.5 p-0 leading-[1.5] text-[var(--color-muted-fg)] text-[10.5px] list-disc">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)] uppercase">
            {matchedLabel}
          </div>
          {keywords.map((k, i) => (
            <div
              key={k.label}
              className="flex items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 font-display text-[11.5px] font-medium"
              style={{
                backgroundColor: `var(--keyword-chip-bg-${k.colorId})`,
                color: `var(--keyword-chip-fg-${k.colorId})`,
                animation: `lr-keyword-pop 350ms ${i * 100}ms both`,
              }}
            >
              <span>{k.label}</span>
              <Check size={11} />
            </div>
          ))}
          <div className="mt-auto px-2.5 py-2 border border-[var(--color-border)] rounded-md flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)] uppercase">
              {matchLabel}
            </span>
            <span className="font-display text-[18px] font-bold text-[var(--color-primary)] tracking-[-0.02em]">
              94%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
