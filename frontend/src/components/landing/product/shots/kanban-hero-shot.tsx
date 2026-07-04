export interface KanbanHeroShotColumn {
  label: string;
  count: number;
}

export interface KanbanHeroShotLabels {
  /** Four columns, in order: SAVED, APPLIED, INTERVIEW, OFFER. The last is highlighted. */
  columns: KanbanHeroShotColumn[];
}

interface KanbanHeroShotProps {
  labels: KanbanHeroShotLabels;
}

interface CardData {
  company: string;
  role: string;
  location: string;
  /** Excitement rating 0-5; when > 0 a 5-dot row is rendered. */
  excitement: number;
}

// Fictional pipeline. Company names are proper nouns; the visible column labels
// arrive via props so pages can localize them.
const CARDS: CardData[][] = [
  [
    { company: "Linear", role: "Sr. Product Designer", location: "Remote", excitement: 5 },
    { company: "Vercel", role: "Design Engineer", location: "SF", excitement: 4 },
    { company: "Cursor", role: "Brand Designer", location: "NYC", excitement: 0 },
  ],
  [
    { company: "Notion", role: "Sr. Designer", location: "NYC", excitement: 4 },
    { company: "Figma", role: "Growth Designer", location: "SF", excitement: 3 },
  ],
  [
    { company: "Stripe", role: "Staff Designer", location: "Remote", excitement: 5 },
    { company: "Ramp", role: "Sr. Designer", location: "NYC", excitement: 0 },
  ],
  [{ company: "Anthropic", role: "Sr. Product Designer", location: "SF", excitement: 5 }],
];

function ExcitementDots({ filled }: { filled: number }) {
  return (
    <div className="flex gap-[3px] mt-1.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((s) => (
        <span
          key={s}
          className={`size-[5px] rounded-full ${
            s < filled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}

export function KanbanHeroShot({ labels }: KanbanHeroShotProps) {
  return (
    <div className="w-full h-full grid grid-cols-4 gap-2.5 p-4 bg-[var(--color-background)] overflow-hidden">
      {labels.columns.slice(0, 4).map((col, ci) => {
        const isOffer = ci === labels.columns.length - 1;
        return (
          <div
            key={col.label}
            className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2.5 flex flex-col gap-2 min-h-0 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[8px] tracking-[0.12em] font-semibold ${
                  isOffer ? "text-[var(--color-primary)]" : "text-[var(--color-muted-fg)]"
                }`}
              >
                {col.label}
              </span>
              <span
                className={`font-mono text-[9px] font-semibold rounded-full px-1.5 py-px ${
                  isOffer
                    ? "text-[var(--color-primary)] bg-[var(--color-primary-10)]"
                    : "text-[var(--color-muted-fg)] bg-[var(--color-background)]"
                }`}
              >
                {col.count}
              </span>
            </div>
            {(CARDS[ci] ?? []).map((card) => (
              <div
                key={card.company}
                className={`bg-[var(--color-background)] rounded-md px-2 py-1.5 border ${
                  isOffer ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                }`}
              >
                <div className="font-display text-[10.5px] font-semibold tracking-[-0.01em] text-[var(--color-foreground)]">
                  {card.role}
                </div>
                <div className="font-mono text-[8px] text-[var(--color-muted-fg)] mt-0.5 truncate">
                  {card.company} · {card.location}
                </div>
                {card.excitement > 0 && <ExcitementDots filled={card.excitement} />}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
