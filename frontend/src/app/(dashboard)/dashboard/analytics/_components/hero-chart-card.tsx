"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsPeriod, TimelineBucket } from "@/lib/types/analytics";

interface HeroChartCardProps {
  current: number;
  previous: number;
  delta: number;
  timeline: TimelineBucket[];
  timelinePrevious: TimelineBucket[];
  period: AnalyticsPeriod;
}

// Map period → tick label format. Daily/weekly buckets use "d MMM"
// (e.g. "15 Apr"), monthly buckets use just "MMM" (e.g. "Apr"). The
// date-fns format itself is locale-agnostic; date-fns will localise day/
// month names automatically when a locale is provided. For simplicity here
// we render in en-locale month names — switching to per-locale date-fns
// locales is a future polish ticket.
function formatTickForPeriod(iso: string, period: AnalyticsPeriod): string {
  try {
    const d = parseISO(iso);
    const pattern = period === "all" ? "LLL" : "d MMM";
    return format(d, pattern);
  } catch {
    return iso;
  }
}

/**
 * Format the delta number with U+2212 minus for negatives and a + sign for
 * positives. Zero returns just "0" (no sign).
 */
function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "0";
}

/**
 * Recharts dot props relevant to us. Recharts passes many more (payload,
 * stroke, etc.); we only need cx/cy/index/key for the last-point halo.
 */
type DotRendererProps = {
  cx?: number;
  cy?: number;
  index?: number;
  key?: string | number;
};

/**
 * Render the dot for a single point on the current series. Only the LAST
 * point gets a visible halo+dot; every other index returns an invisible `<g>`
 * (recharts crashes if a dot renderer returns `null`).
 */
function renderLastPointDot(
  props: DotRendererProps,
  lastIndex: number
): React.ReactElement<SVGElement> {
  const { cx, cy, index, key } = props;
  if (index !== lastIndex || cx === undefined || cy === undefined) {
    return <g key={key} display="none" />;
  }
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={8} fill="var(--chart-1)" opacity={0.25} />
      <circle cx={cx} cy={cy} r={4} fill="var(--chart-1)" />
    </g>
  );
}

interface ChartRow {
  date: string;
  current: number | null;
  previous: number | null;
}

/**
 * Hero block — big number + dual-series line chart with previous-period
 * dashed overlay. Spans 2 cols on desktop.
 *
 * Empty state (no applications in the current period): hide the chart, show a
 * centered CTA linking to /dashboard/jobs.
 */
export function HeroChartCard({
  current,
  previous,
  delta,
  timeline,
  timelinePrevious,
  period,
}: HeroChartCardProps) {
  const t = useTranslations("analytics");

  const chartConfig: ChartConfig = React.useMemo(
    () => ({
      current: {
        label: t("hero_legend_current"),
        color: "var(--chart-1)",
      },
      previous: {
        label: t("hero_legend_previous"),
        color: "var(--muted-foreground)",
      },
    }),
    [t]
  );

  const comparisonLabel = React.useMemo(() => {
    switch (period) {
      case "7d":
        return t("hero_compare_7d");
      case "30d":
        return t("hero_compare_30d");
      case "90d":
        return t("hero_compare_90d");
      case "all":
        return t("hero_compare_all");
    }
  }, [period, t]);

  // Empty state: no current applications AND no historical timeline data.
  const isEmpty =
    current === 0 &&
    (timeline.length === 0 || timeline.every((b) => b.count === 0)) &&
    timelinePrevious.length === 0;

  const showPrevious = period !== "all" && timelinePrevious.length > 0;

  // Build a merged data array indexed by the current series' x-axis so the
  // dashed previous line aligns visually.
  const chartData = React.useMemo<ChartRow[]>(() => {
    const rows: ChartRow[] = timeline.map((bucket, i) => ({
      date: bucket.date,
      current: bucket.count,
      previous: showPrevious ? timelinePrevious[i]?.count ?? null : null,
    }));
    return rows;
  }, [timeline, timelinePrevious, showPrevious]);

  // Three ticks: start, middle, end.
  const tickValues = React.useMemo(() => {
    if (chartData.length === 0) return [] as string[];
    if (chartData.length === 1) return [chartData[0].date];
    if (chartData.length === 2) return [chartData[0].date, chartData[1].date];
    return [
      chartData[0].date,
      chartData[Math.floor(chartData.length / 2)].date,
      chartData[chartData.length - 1].date,
    ];
  }, [chartData]);

  const lastIndex = chartData.length - 1;
  const dotRenderer = React.useCallback(
    (props: DotRendererProps) => renderLastPointDot(props, lastIndex),
    [lastIndex]
  );

  const DeltaIcon = delta < 0 ? TrendingDown : TrendingUp;

  return (
    <Card className="lg:col-span-2">
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Header: number + delta + legend */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("hero_label")}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span
                className="font-medium leading-none"
                style={{ fontSize: "44px" }}
              >
                {current}
              </span>
              <Badge
                className="border-transparent gap-1 font-medium"
                style={{
                  background: "var(--success-bg)",
                  color: "var(--success)",
                }}
              >
                <DeltaIcon className="h-3 w-3" />
                {formatDelta(delta)}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {comparisonLabel}
              </span>
              {/* Previous-period count for assistive tech. */}
              <span className="sr-only">{previous}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 2,
                  background: "var(--chart-1)",
                  display: "inline-block",
                }}
              />
              <span>{t("hero_legend_current")}</span>
            </div>
            {showPrevious ? (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    borderTop: "1.5px dashed var(--muted-foreground)",
                    display: "inline-block",
                  }}
                />
                <span>{t("hero_legend_previous")}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Chart / empty state */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("hero_empty")}</p>
            <Button asChild size="sm">
              <Link href="/dashboard/jobs">{t("hero_empty_cta")}</Link>
            </Button>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="2 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="date"
                ticks={tickValues}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) =>
                  formatTickForPeriod(value, period)
                }
                interval="preserveStartEnd"
                fontSize={10}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{
                  stroke: "var(--border)",
                  strokeDasharray: "2 3",
                }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(value) =>
                      typeof value === "string"
                        ? formatTickForPeriod(value, period)
                        : String(value)
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="current"
                stroke="transparent"
                fill="var(--chart-1)"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              {showPrevious ? (
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="current"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={dotRenderer}
                activeDot={{ r: 4, fill: "var(--chart-1)" }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
