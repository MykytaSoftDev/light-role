export interface AnalyticsKpiLabels {
  label: string;
  value: string;
  delta: string;
}

export interface AnalyticsFunnelStage {
  label: string;
  count: number;
}

export interface AnalyticsHeroShotLabels {
  /** Three KPI cards. */
  kpis: AnalyticsKpiLabels[];
  funnelTitle: string;
  /** Funnel stages, descending (e.g. SAVED 34 → ACCEPTED 1). */
  funnel: AnalyticsFunnelStage[];
}

interface AnalyticsHeroShotProps {
  labels: AnalyticsHeroShotLabels;
}

const BARS = [42, 55, 38, 68, 72, 58, 84, 76, 92, 84, 71, 88] as const;

export function AnalyticsHeroShot({ labels }: AnalyticsHeroShotProps) {
  const maxCount = Math.max(1, ...labels.funnel.map((s) => s.count));

  return (
    <div className="w-full h-full flex flex-col gap-3 p-4 bg-[var(--color-background)] overflow-hidden">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-2">
        {labels.kpis.slice(0, 3).map((kpi) => (
          <div
            key={kpi.label}
            className="border border-[var(--color-border)] rounded-md px-2.5 py-2"
          >
            <div className="font-mono text-[8px] tracking-[0.1em] text-[var(--color-muted-fg)] uppercase">
              {kpi.label}
            </div>
            <div className="font-display text-[18px] font-bold tracking-[-0.03em] text-[var(--color-foreground)] mt-0.5">
              {kpi.value}
            </div>
            <div className="font-mono text-[9px] text-[var(--color-primary)]">{kpi.delta}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex-1 min-h-0 border border-[var(--color-border)] rounded-md p-3.5 flex items-end gap-1.5">
        {BARS.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--color-primary)] rounded-[3px]"
            style={{ height: `${h}%`, opacity: i === BARS.length - 1 ? 1 : 0.55 }}
          />
        ))}
      </div>

      {/* Funnel strip */}
      <div className="border border-[var(--color-border)] rounded-md px-3 py-2.5 flex flex-col gap-1.5">
        <div className="font-mono text-[8px] tracking-[0.1em] text-[var(--color-muted-fg)] uppercase">
          {labels.funnelTitle}
        </div>
        <div className="flex flex-col gap-1">
          {labels.funnel.map((stage) => (
            <div key={stage.label} className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-[var(--color-muted-fg)] w-[68px] shrink-0 truncate uppercase tracking-[0.06em]">
                {stage.label}
              </span>
              <div className="flex-1 h-[7px] rounded-full bg-[var(--color-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${(stage.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[8.5px] font-semibold text-[var(--color-foreground)] w-5 text-right tabular-nums">
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
