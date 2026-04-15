"use client";

import { useTranslations } from "next-intl";
import type { AIOperationCount } from "@/lib/types/analytics";

interface AIOperationsBreakdownProps {
  operations: AIOperationCount[];
}

const OPERATION_LABELS: Record<string, string> = {
  job_parse: "Job Parsing",
  resume_analyze: "Resume Analysis",
  cl_generate: "Cover Letter",
  cl_regenerate: "Cover Letter (Regen)",
};

export function AIOperationsBreakdown({ operations }: AIOperationsBreakdownProps) {
  const t = useTranslations("analytics");

  const active = operations.filter((op) => op.count > 0);
  const sorted = [...active].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, op) => sum + op.count, 0);
  const maxCount = sorted[0]?.count ?? 1;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("ai_ops_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("ai_ops_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("ai_ops_title")}</h2>

      <div className="flex flex-col gap-3">
        {sorted.map((op) => {
          const knownOps = ["job_parse", "resume_analyze", "cl_generate", "cl_regenerate"];
          const label = knownOps.includes(op.operation_type)
            ? t(`ai_op_${op.operation_type}` as Parameters<typeof t>[0])
            : (OPERATION_LABELS[op.operation_type] ?? op.operation_type);
          const widthPct = Math.max((op.count / maxCount) * 100, 4);

          return (
            <div key={op.operation_type} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{op.count}</span>
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

      <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
        <span className="text-muted-foreground">{t("ai_ops_total")}</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </div>
    </div>
  );
}
