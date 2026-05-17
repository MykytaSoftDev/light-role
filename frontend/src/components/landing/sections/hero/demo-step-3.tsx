import { BracketTag } from "@/components/landing/chrome/bracket-tag";

interface ColumnSpec {
  name: string;
  count: number;
  isOffer?: boolean;
  cards: { company: string; role: string }[];
}

interface DemoStep3Props {
  active: boolean;
  title: string;
  stepLabel: string;
  cols: ColumnSpec[];
  typingLabel: string;
}

export function DemoStep3({ active, title, stepLabel, cols, typingLabel }: DemoStep3Props) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 px-7 py-[22px] flex flex-col gap-3.5 transition-[opacity,transform] duration-[350ms] ${
        active ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="flex items-baseline gap-3.5">
        <BracketTag num="3" label={stepLabel} />
      </div>
      <h3 className="m-0 font-display text-[24px] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">
        {title}
      </h3>
      <div className="flex-1 grid grid-cols-4 gap-2.5 min-h-0">
        {cols.map((c, ci) => (
          <div
            key={c.name}
            className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-2.5 pt-2.5 pb-3 flex flex-col gap-2 min-h-0 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.12em] text-[var(--color-muted-fg)]">
                {c.name}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold rounded-full px-1.5 py-px ${
                  c.isOffer
                    ? "text-[var(--color-primary)] bg-[var(--color-primary-10)]"
                    : "text-[var(--color-muted-fg)] bg-[var(--color-background)]"
                }`}
              >
                {c.count}
              </span>
            </div>
            {c.cards.map((card, i) => (
              <div
                key={card.company}
                className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-md px-2 py-1.5"
                style={{
                  animation: `lr-keyword-pop 300ms ${ci * 70 + i * 50}ms both`,
                }}
              >
                <div className="font-display text-[11.5px] font-semibold text-[var(--color-foreground)] tracking-[-0.01em]">
                  {card.company}
                </div>
                <div className="font-display text-[10.5px] text-[var(--color-muted-fg)] mt-px">
                  {card.role}
                </div>
                <div className="flex gap-[3px] mt-1.5">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <span
                      key={s}
                      aria-hidden="true"
                      className="w-[5px] h-[5px] rounded-full"
                      style={{
                        background:
                          s < 4 - ci ? "var(--color-primary)" : "var(--color-border)",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-muted-fg)] uppercase tracking-[0.12em]">
        <span>{typingLabel}</span>
        <span
          aria-hidden="true"
          className="inline-block w-[6px] h-[10px] bg-[var(--color-primary)]"
          style={{ animation: "lr-type-cursor 900ms steps(1,end) infinite" }}
        />
      </div>
    </div>
  );
}
