"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ResumePerformanceData } from "@/lib/types/analytics";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { cn } from "@/lib/utils";

interface ResumePerformanceProps {
  performance: ResumePerformanceData;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const width = 120;
  const height = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const d = `M ${coords.join(" L ")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-indigo-500"
      />
    </svg>
  );
}

function trendColor(trend: ResumePerformanceData["trend"]): string {
  if (trend === "improving") return "text-emerald-600 dark:text-emerald-400";
  if (trend === "declining") return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

export function ResumePerformance({ performance }: ResumePerformanceProps) {
  const t = useTranslations("analytics");

  const hasData =
    performance.avg_score !== null || performance.sparkline.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("resume_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("resume_empty")}</p>
        <Link
          href={DASHBOARD_PAGES.TAILOR_RESUME}
          className="text-sm text-primary font-medium hover:underline w-fit"
        >
          {t("resume_empty_cta")}
        </Link>
      </div>
    );
  }

  const sparklineScores = performance.sparkline.slice(-10).map((p) => p.score);
  const trendLabel = performance.trend
    ? t(`resume_trend_${performance.trend}` as Parameters<typeof t>[0])
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("resume_title")}</h2>

      {/* Avg score + sparkline */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          {performance.avg_score !== null && (
            <>
              <span className="text-4xl font-bold tracking-tight">
                {performance.avg_score.toFixed(0)}
                <span className="text-xl text-muted-foreground">%</span>
              </span>
              <span className="text-xs text-muted-foreground">{t("resume_avg_label")}</span>
            </>
          )}
          {trendLabel && (
            <span className={cn("text-sm font-medium mt-1", trendColor(performance.trend))}>
              {trendLabel}
            </span>
          )}
        </div>
        {sparklineScores.length >= 2 && (
          <Sparkline points={sparklineScores} />
        )}
      </div>

      {/* Best / worst */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        {performance.best_resume_id && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("resume_best_label")}</span>
            <Link
              href={`${DASHBOARD_PAGES.RESUMES}/${performance.best_resume_id}`}
              className="text-sm font-medium text-primary hover:underline truncate"
            >
              {performance.best_resume_name}
            </Link>
            {performance.best_score !== null && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {performance.best_score.toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {performance.worst_resume_id && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("resume_worst_label")}</span>
            <Link
              href={`${DASHBOARD_PAGES.RESUMES}/${performance.worst_resume_id}`}
              className="text-sm font-medium text-primary hover:underline truncate"
            >
              {performance.worst_resume_name}
            </Link>
            {performance.worst_score !== null && (
              <span className="text-xs text-rose-600 dark:text-rose-400">
                {performance.worst_score.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
