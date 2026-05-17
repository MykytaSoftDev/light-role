interface KanbanShotProps {
  labelSaved: string;
  labelApplied: string;
  labelInterview: string;
  labelOffer: string;
}

export function KanbanShot({
  labelSaved,
  labelApplied,
  labelInterview,
  labelOffer,
}: KanbanShotProps) {
  const cols = [
    { name: labelSaved, count: 7, isOffer: false },
    { name: labelApplied, count: 5, isOffer: false },
    { name: labelInterview, count: 2, isOffer: false },
    { name: labelOffer, count: 1, isOffer: true },
  ];
  return (
    <div className="w-full h-full p-4 grid grid-cols-4 gap-2 bg-[var(--color-background)]">
      {cols.map((c) => (
        <div
          key={c.name}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-md p-2 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono text-[8px] tracking-[0.12em] font-semibold ${
                c.isOffer ? "text-[var(--color-primary)]" : "text-[var(--color-muted-fg)]"
              }`}
            >
              {c.name}
            </span>
            <span className="font-mono text-[9px] text-[var(--color-muted-fg)]">
              {c.count}
            </span>
          </div>
          {[0, 1, 2].slice(0, c.count > 2 ? 3 : c.count).map((i) => (
            <div
              key={i}
              className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-sm px-1.5 py-1"
            >
              <div className="h-1.5 w-[70%] bg-[var(--color-secondary)] rounded-sm" />
              <div className="h-1 w-[45%] bg-[var(--color-secondary)] rounded-sm mt-0.5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
