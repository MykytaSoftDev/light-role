"use client";

import { useTranslations } from "next-intl";
import type { FunnelData } from "@/lib/types/analytics";
import { Info } from "lucide-react";

interface ConversionFunnelProps {
  funnel: FunnelData;
}

export function ConversionFunnel({ funnel }: ConversionFunnelProps) {
  const t = useTranslations("analytics");

  const savedStage = funnel.stages.find((s) => s.stage === "saved");
  const savedCount = savedStage?.count ?? 1;

  if (funnel.stages.length === 0 || savedCount === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("funnel_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("funnel_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("funnel_title")}</h2>

      <div className="flex flex-col gap-3">
        {funnel.stages.map((stage) => {
          const widthPct = Math.max((stage.count / savedCount) * 100, 2);
          const knownStages = ["saved", "applied", "screening", "interview", "offer", "accepted"];
          const stageLabel = knownStages.includes(stage.stage)
            ? t(`funnel_stage_${stage.stage}` as Parameters<typeof t>[0])
            : stage.stage;

          return (
            <div key={stage.stage} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium capitalize">{stageLabel}</span>
                <div className="flex items-center gap-3">
                  <span>{stage.count}</span>
                  <span>{stage.pct_of_saved.toFixed(0)}%</span>
                  {stage.drop_off_pct !== null && (
                    <span className="text-rose-500">↓{stage.drop_off_pct.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {funnel.insight && (
        <div className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{funnel.insight}</p>
        </div>
      )}
    </div>
  );
}
