"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/hooks/api/useAnalytics";
import type { AnalyticsPeriod, AnalyticsResponse } from "@/lib/types/analytics";
import { DEMO_ANALYTICS_DATA } from "@/lib/analytics/demoData";
import { AnalyticsErrorBoundary } from "@/components/analytics/AnalyticsErrorBoundary";
import { HeroStats } from "@/components/analytics/HeroStats";
import { ConversionFunnel } from "@/components/analytics/ConversionFunnel";
import { ApplicationsTimeline } from "@/components/analytics/ApplicationsTimeline";
import { StatusBreakdown } from "@/components/analytics/StatusBreakdown";
import { ResumePerformance } from "@/components/analytics/ResumePerformance";
import { ResponseTime } from "@/components/analytics/ResponseTime";
import { AIOperationsBreakdown } from "@/components/analytics/AIOperationsBreakdown";
import { UpgradeOverlay } from "@/components/analytics/UpgradeOverlay";
import { InsufficientDataState } from "@/components/analytics/InsufficientDataState";
import { StatCardSkeleton } from "@/components/analytics/StatCardSkeleton";
import { cn } from "@/lib/utils";

const PERIODS: { value: AnalyticsPeriod; labelKey: string }[] = [
  { value: "7d", labelKey: "period_7d" },
  { value: "30d", labelKey: "period_30d" },
  { value: "90d", labelKey: "period_90d" },
  { value: "all", labelKey: "period_all" },
];

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

interface PeriodSelectorProps {
  current: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}

function PeriodSelector({ current, onChange }: PeriodSelectorProps) {
  const t = useTranslations("analytics");
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 gap-1" role="group" aria-label={t("period_selector_label")}>
      {PERIODS.map(({ value, labelKey }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            current === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={current === value}
        >
          {t(labelKey as "period_7d" | "period_30d" | "period_90d" | "period_all")}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics cards grid
// ---------------------------------------------------------------------------

function AnalyticsCards({ data }: { data: AnalyticsResponse }) {
  return (
    <>
      <HeroStats counters={data.hero_counters} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnel funnel={data.funnel} />
        <StatusBreakdown statusBreakdown={data.status_breakdown} />
        <ApplicationsTimeline timeline={data.timeline} />
        <ResumePerformance performance={data.resume_performance} />
        <ResponseTime responseTime={data.response_time} />
        <AIOperationsBreakdown operations={data.ai_operations} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page loading skeleton
// ---------------------------------------------------------------------------

function AnalyticsLoadingSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inner content (reads hook state)
// ---------------------------------------------------------------------------

function AnalyticsContent({ period }: { period: AnalyticsPeriod }) {
  const t = useTranslations("analytics");
  const { data, error, isLoading } = useAnalytics(period);

  if (isLoading) return <AnalyticsLoadingSkeleton />;

  // 402 → show upgrade overlay on top of blurred demo data
  if (error?.status === 402) {
    return (
      <div className="relative">
        <div className="pointer-events-none blur-sm opacity-50 select-none" aria-hidden="true">
          <AnalyticsCards data={DEMO_ANALYTICS_DATA} />
        </div>
        <UpgradeOverlay />
      </div>
    );
  }

  // Other errors — let the error boundary catch render errors, but handle query errors here
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-muted-foreground">{t("error_generic")}</p>
      </div>
    );
  }

  if (!data) return null;

  // Pro user but not enough data yet
  if (!data.data_sufficiency.has_sufficient_data) {
    return <InsufficientDataState sufficiency={data.data_sufficiency} />;
  }

  return <AnalyticsCards data={data} />;
}

// ---------------------------------------------------------------------------
// Page wrapper (reads search params)
// ---------------------------------------------------------------------------

function AnalyticsPageInner() {
  const t = useTranslations("analytics");
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawPeriod = searchParams.get("period");
  const period: AnalyticsPeriod =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d" || rawPeriod === "all"
      ? rawPeriod
      : "30d";

  function handlePeriodChange(next: AnalyticsPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("page_title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("page_subtitle")}</p>
        </div>
        <PeriodSelector current={period} onChange={handlePeriodChange} />
      </div>

      <AnalyticsContent period={period} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export with error boundary + Suspense
// ---------------------------------------------------------------------------

function AnalyticsPageWithBoundary() {
  const t = useTranslations("analytics");
  return (
    <AnalyticsErrorBoundary
      message={t("error_boundary_message")}
      retryLabel={t("error_boundary_retry")}
    >
      <Suspense>
        <AnalyticsPageInner />
      </Suspense>
    </AnalyticsErrorBoundary>
  );
}

export default function AnalyticsPage() {
  return <AnalyticsPageWithBoundary />;
}
