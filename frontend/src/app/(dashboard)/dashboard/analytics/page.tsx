"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AnalyticsErrorBoundary } from "@/components/analytics/AnalyticsErrorBoundary";
import { UpgradeOverlay } from "@/components/analytics/UpgradeOverlay";
import { useAnalytics } from "@/hooks/api/useAnalytics";
import type { AnalyticsPeriod } from "@/lib/types/analytics";
import { Button } from "@/components/ui/button";

import { AnalyticsHeader } from "./_components/analytics-header";
import { HeroChartCard } from "./_components/hero-chart-card";
import { KpiStrip } from "./_components/kpi-strip";
import { StreakCard } from "./_components/streak-card";
import { FunnelCard } from "./_components/funnel-card";
import { StatusDonutCard } from "./_components/status-donut-card";
import { GenerationsCard } from "./_components/generations-card";
import { ActivityFeedCard } from "./_components/activity-feed-card";
import { AnalyticsLoadingSkeleton } from "./_components/analytics-loading";

// ---------------------------------------------------------------------------
// Content shell — reads the query and branches on its state.
//
// Loading rules (SPEC §9.4):
//  - Initial load (no data yet) → render the full-page skeleton.
//  - Refetch (period change) → keep the previous data visible, dim with
//    opacity-60 to telegraph the in-flight request.
// ---------------------------------------------------------------------------

function AnalyticsContent({ period }: { period: AnalyticsPeriod }) {
  const t = useTranslations("analytics");
  const { data, error, isLoading, isFetching } = useAnalytics(period);

  // 402 → Pro gate. The upgrade overlay paints over a blurred skeleton row
  // set so the visual structure is preserved without leaking real data.
  if (error?.status === 402) {
    return (
      <div className="relative flex flex-col gap-4">
        <div
          className="pointer-events-none select-none blur-sm opacity-50"
          aria-hidden="true"
        >
          <AnalyticsLoadingSkeleton />
        </div>
        <UpgradeOverlay />
      </div>
    );
  }

  if (error) {
    // Generic error — surface a muted message; the wrapping
    // AnalyticsErrorBoundary handles render-time exceptions.
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">{t("error_generic")}</p>
      </div>
    );
  }

  // Initial load (no data yet) — show the full skeleton.
  if (isLoading || !data) {
    return <AnalyticsLoadingSkeleton />;
  }

  // Detect page-level empty state (everything is zero) so we can short-circuit
  // to a single CTA instead of rendering five separate empty cards. This
  // matches mockup polish: a brand-new account should get a one-screen
  // "let's go" rather than a sea of empty widgets.
  const isTotallyEmpty =
    data.applications_current === 0 &&
    data.applications_timeline.every((b) => b.count === 0) &&
    data.applications_timeline_previous.length === 0 &&
    data.current_streak_days === 0 &&
    data.daily_activity.every((d) => d.count === 0) &&
    data.jobs_saved.current === 0 &&
    data.applied.current === 0 &&
    data.interviews.current === 0 &&
    data.offers.current === 0 &&
    data.funnel.every((s) => s.count === 0) &&
    data.status_breakdown.every((s) => s.count === 0) &&
    data.generations_total_resumes === 0 &&
    data.generations_total_cover_letters === 0 &&
    data.recent_activity.length === 0;

  if (isTotallyEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">{t("hero_empty")}</p>
        <Button asChild>
          <Link href="/dashboard/jobs">{t("hero_empty_cta")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        isFetching ? "flex flex-col gap-4 opacity-60 transition-opacity" : "flex flex-col gap-4"
      }
    >
      {/* Row 1 — hero chart (2/3) + streak (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HeroChartCard
          current={data.applications_current}
          previous={data.applications_previous}
          delta={data.applications_delta}
          timeline={data.applications_timeline}
          timelinePrevious={data.applications_timeline_previous}
          period={period}
        />
        <StreakCard
          currentStreak={data.current_streak_days}
          longestStreak={data.longest_streak_days}
          dailyActivity={data.daily_activity}
          personalBest={data.personal_best}
        />
      </div>

      {/* Row 2 — KPI strip (4 cards) */}
      <KpiStrip data={data} />

      {/* Row 3 — funnel + donut (50/50) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelCard funnel={data.funnel} funnelInsight={data.funnel_insight} />
        <StatusDonutCard statusBreakdown={data.status_breakdown} />
      </div>

      {/* Row 4 — generations area chart (full width) */}
      <GenerationsCard
        generationsTotalResumes={data.generations_total_resumes}
        generationsTotalCoverLetters={data.generations_total_cover_letters}
        generationsTimeline={data.generations_timeline}
        period={period}
      />

      {/* Row 5 — recent activity (full width, hides itself when empty) */}
      <ActivityFeedCard recentActivity={data.recent_activity} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper — owns the period parsing from the URL.
// ---------------------------------------------------------------------------

function AnalyticsPageInner() {
  const searchParams = useSearchParams();

  const rawPeriod = searchParams?.get("period") ?? null;
  const period: AnalyticsPeriod =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d" || rawPeriod === "all"
      ? rawPeriod
      : "30d";

  return (
    <div className="flex flex-col gap-6 p-6">
      <AnalyticsHeader period={period} />
      <AnalyticsContent period={period} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — error boundary + Suspense (Next 16 requires
// `useSearchParams` to live inside a Suspense boundary).
//
// The error boundary is a class component (can't use hooks), so we feed it
// translated copy via a small functional wrapper that owns the translation.
// ---------------------------------------------------------------------------

function TranslatedErrorBoundary({ children }: { children: React.ReactNode }) {
  const t = useTranslations("analytics");
  return (
    <AnalyticsErrorBoundary
      message={t("error_boundary_message")}
      retryLabel={t("error_boundary_retry")}
    >
      {children}
    </AnalyticsErrorBoundary>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense>
      <TranslatedErrorBoundary>
        <AnalyticsPageInner />
      </TranslatedErrorBoundary>
    </Suspense>
  );
}
