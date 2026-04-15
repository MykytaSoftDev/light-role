"use client";

import { useTranslations } from "next-intl";
import type { StatusCount } from "@/lib/types/analytics";

interface StatusBreakdownProps {
  statusBreakdown: StatusCount[];
}

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-400 dark:bg-slate-500",
  applied: "bg-blue-500",
  screening: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-emerald-500",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  saved: "bg-slate-400 dark:bg-slate-500",
  applied: "bg-blue-500",
  screening: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-emerald-500",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-muted-foreground";
}

export function StatusBreakdown({ statusBreakdown }: StatusBreakdownProps) {
  const t = useTranslations("analytics");

  const active = statusBreakdown.filter((s) => s.count > 0);
  const total = active.reduce((sum, s) => sum + s.count, 0);

  if (active.length === 0 || total === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("status_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("status_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("status_title")}</h2>

      <div className="flex flex-col gap-4">
        {/* Stacked bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full gap-0.5">
          {active.map((s) => (
            <div
              key={s.status}
              className={`${getStatusColor(s.status)} transition-all duration-500`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.status}: ${s.count}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {active.map((s) => {
            const pct = ((s.count / total) * 100).toFixed(0);
            const dotColor = STATUS_DOT_COLORS[s.status] ?? "bg-muted-foreground";
            const knownStatuses = ["saved", "applied", "screening", "interview", "offer"];
            const label = knownStatuses.includes(s.status)
              ? t(`status_${s.status}` as Parameters<typeof t>[0])
              : s.status;
            return (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="capitalize">{label}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{s.count}</span>
                  <span className="text-xs">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
