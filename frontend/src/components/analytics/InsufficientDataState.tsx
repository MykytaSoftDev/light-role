"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import type { DataSufficiency } from "@/lib/types/analytics";
import { Button } from "@/components/ui/button";

interface InsufficientDataStateProps {
  sufficiency: DataSufficiency;
}

interface ProgressRowProps {
  label: string;
  current: number;
  threshold: number;
}

function ProgressRow({ label, current, threshold }: ProgressRowProps) {
  const pct = Math.min((current / Math.max(threshold, 1)) * 100, 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {current} / {threshold}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function InsufficientDataState({ sufficiency }: InsufficientDataStateProps) {
  const t = useTranslations("analytics");

  return (
    <div className="flex flex-col items-center gap-6 py-12 max-w-md mx-auto text-center">
      {/* Icon */}
      <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-full">
        <svg
          className="text-primary h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("insufficient_headline")}</h2>
        <p className="text-sm text-muted-foreground">{t("insufficient_description")}</p>
      </div>

      {/* Progress rows */}
      <div className="w-full flex flex-col gap-4 text-left rounded-xl border border-border bg-card p-6">
        <ProgressRow
          label={t("insufficient_jobs_label")}
          current={sufficiency.total_jobs}
          threshold={sufficiency.threshold_jobs}
        />
        <ProgressRow
          label={t("insufficient_applications_label")}
          current={sufficiency.total_applications}
          threshold={sufficiency.threshold_applications}
        />
        <ProgressRow
          label={t("insufficient_resumes_label")}
          current={sufficiency.total_scored_resumes}
          threshold={sufficiency.threshold_scored_resumes}
        />
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild>
          <Link href={DASHBOARD_PAGES.JOBS + "/new"}>{t("insufficient_cta_jobs")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={DASHBOARD_PAGES.TAILOR_RESUME}>{t("insufficient_cta_resumes")}</Link>
        </Button>
      </div>
    </div>
  );
}
