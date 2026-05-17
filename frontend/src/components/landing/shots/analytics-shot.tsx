interface AnalyticsShotProps {
  statLabel1: string;
  statValue1: string;
  statDelta1: string;
  statLabel2: string;
  statValue2: string;
  statDelta2: string;
  statLabel3: string;
  statValue3: string;
  statDelta3: string;
}

const BARS = [42, 55, 38, 68, 72, 58, 84, 76, 92, 84, 71, 88] as const;

export function AnalyticsShot({
  statLabel1,
  statValue1,
  statDelta1,
  statLabel2,
  statValue2,
  statDelta2,
  statLabel3,
  statValue3,
  statDelta3,
}: AnalyticsShotProps) {
  const stats = [
    { label: statLabel1, value: statValue1, delta: statDelta1 },
    { label: statLabel2, value: statValue2, delta: statDelta2 },
    { label: statLabel3, value: statValue3, delta: statDelta3 },
  ];
  return (
    <div className="w-full h-full p-4 bg-[var(--color-background)] flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, value, delta }) => (
          <div
            key={label}
            className="border border-[var(--color-border)] rounded-md px-2.5 py-2"
          >
            <div className="font-mono text-[8px] tracking-[0.1em] text-[var(--color-muted-fg)] uppercase">
              {label}
            </div>
            <div className="font-display text-[18px] font-bold tracking-[-0.03em] text-[var(--color-foreground)] mt-0.5">
              {value}
            </div>
            <div className="font-mono text-[9px] text-[var(--color-primary)]">{delta}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 border border-[var(--color-border)] rounded-md p-3.5 flex items-end gap-1.5">
        {BARS.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--color-primary)] rounded-[3px]"
            style={{
              height: `${h}%`,
              opacity: i === BARS.length - 1 ? 1 : 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}
