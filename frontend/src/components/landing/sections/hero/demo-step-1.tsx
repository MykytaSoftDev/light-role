import { Check } from "lucide-react";

import { BracketTag } from "@/components/landing/chrome/bracket-tag";

interface DemoStep1Props {
  active: boolean;
  title: string;
  stepLabel: string;
  jdTitle: string;
  jdBody: string;
  jdReqs: string;
  fields: { key: string; value: string; done: boolean }[];
}

export function DemoStep1({
  active,
  title,
  stepLabel,
  jdTitle,
  jdBody,
  jdReqs,
  fields,
}: DemoStep1Props) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 px-7 py-[22px] flex flex-col gap-3.5 transition-[opacity,transform] duration-[350ms] ${
        active ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="flex items-baseline gap-3.5">
        <BracketTag num="1" label={stepLabel} />
      </div>
      <h3 className="m-0 font-display text-[24px] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">
        {title}
      </h3>
      <div className="flex-1 min-h-0 bg-[var(--color-card)] border border-dashed border-[var(--color-border)] rounded-[10px] p-3.5 grid grid-cols-[1.1fr_1fr] gap-3.5">
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3.5 py-3 font-mono text-[11px] leading-[1.55] text-[var(--color-muted-fg)] overflow-hidden">
          <div className="text-[var(--color-foreground)] mb-1.5">{jdTitle}</div>
          <div>{jdBody}</div>
          <div className="mt-2">{jdReqs}</div>
          <div
            className="mt-2 h-2.5 bg-[var(--color-secondary)] rounded-[3px] w-3/5 origin-left"
            style={{ animation: "lr-bar-grow 700ms ease-out 200ms both" }}
          />
          <div
            className="mt-1 h-2.5 bg-[var(--color-secondary)] rounded-[3px] w-2/5 origin-left"
            style={{ animation: "lr-bar-grow 700ms ease-out 380ms both" }}
          />
        </div>
        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div
              key={f.key}
              className="border border-[var(--color-border)] rounded-md px-2.5 py-1.5 bg-[var(--color-background)] flex items-center justify-between gap-2"
              style={
                f.done
                  ? { animation: `lr-keyword-pop 350ms ${i * 80}ms both` }
                  : undefined
              }
            >
              <div>
                <div className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)]">
                  {f.key}
                </div>
                <div className="font-display text-[12.5px] font-medium text-[var(--color-foreground)] mt-px">
                  {f.value}
                </div>
              </div>
              {f.done ? (
                <span className="text-[var(--color-primary)]">
                  <Check size={13} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]"
                  style={{ animation: "lr-pulse-dot 1s infinite" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
