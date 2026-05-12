"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page loading skeleton for /dashboard/analytics.
 *
 * Mirrors the 5-row layout of the real page so the initial paint matches the
 * post-load layout — no shuffle, no layout shift. Per SPEC §9.4 only initial
 * fetch shows the skeleton; period refetches keep the previous data visible
 * and apply an opacity dim (handled at the page-shell level).
 *
 * Each row's skeleton renders one variant matching the corresponding card's
 * footprint:
 *  - Row 1: hero (2/3) + streak (1/3)
 *  - Row 2: 4 KPI cells (collapsing 2x on mobile)
 *  - Row 3: funnel + donut (50/50)
 *  - Row 4: generations area chart
 *  - Row 5: activity feed list
 */
export function AnalyticsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Row 1 — hero chart (2/3) + streak (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HeroChartSkeleton />
        <StreakSkeleton />
      </div>

      {/* Row 2 — KPI strip (4 cards) */}
      <KpiStripSkeleton />

      {/* Row 3 — funnel + donut (50/50) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelSkeleton />
        <DonutSkeleton />
      </div>

      {/* Row 4 — generations chart (full width) */}
      <GenerationsSkeleton />

      {/* Row 5 — activity feed (full width) */}
      <ActivityFeedSkeleton />
    </div>
  );
}

function HeroChartSkeleton() {
  return (
    <Card className="lg:col-span-2">
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Header bar: label + big number + delta pill + legend */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {/* Chart rectangle */}
        <Skeleton className="h-[180px] w-full" />
      </CardContent>
    </Card>
  );
}

function StreakSkeleton() {
  return (
    <Card className="lg:col-span-1">
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Label + big number */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Heatmap grid — 13×7 small squares */}
        <div
          className="grid w-full gap-[3px]"
          style={{
            gridTemplateColumns: "repeat(13, 1fr)",
            gridTemplateRows: "repeat(7, 1fr)",
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 91 }).map((_, i) => (
            <Skeleton
              key={i}
              style={{ aspectRatio: "1 / 1", borderRadius: 2 }}
            />
          ))}
        </div>

        {/* Heatmap footer */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Trophy/personal-best line */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-5 w-5 shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-muted rounded-md p-3.5 pb-2.5 flex flex-col gap-1.5"
        >
          {/* icon + label row */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3 w-16" />
          </div>
          {/* big number */}
          <Skeleton className="h-6 w-14 mt-1" />
          {/* sparkline */}
          <Skeleton className="h-7 w-full mt-1" />
        </div>
      ))}
    </div>
  );
}

function FunnelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-44 mt-1" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-[7px] w-full rounded-sm" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DonutSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40 mt-1" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Donut circle */}
        <div className="mx-auto flex h-[170px] w-[170px] items-center justify-center">
          <Skeleton className="h-[170px] w-[170px] rounded-full" />
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-3 w-3 rounded-sm" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GenerationsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-[200px] w-full" />
        <div className="flex gap-6">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeedSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-44" />
        </div>
        <Skeleton className="h-3 w-20" />
      </CardHeader>
      <CardContent className="p-0 px-6 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0"
          >
            {/* Icon plate */}
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            {/* Two text lines */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-2.5 w-12 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
