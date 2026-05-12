"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsPeriod, GenerationBucket } from "@/lib/types/analytics";

interface GenerationsCardProps {
  generationsTotalResumes: number;
  generationsTotalCoverLetters: number;
  generationsTimeline: GenerationBucket[];
  period: AnalyticsPeriod;
}

// Same tick logic as the hero chart so the two timelines visually align.
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
 * Row 4 — full-width stacked-area chart of resumes & cover letters generated
 * over the selected period. Same granularity rules as the hero chart (daily /
 * weekly / monthly, server-determined) so the two stack visually.
 *
 * Stacking order matters for SPEC §5.5: resumes (`var(--chart-2)`) on the
 * BOTTOM layer, cover letters (`var(--chart-1)`) on top. Recharts paints
 * Areas in declaration order, so the bottom layer is declared first and the
 * top layer overlays it.
 *
 * Empty state: when neither resumes nor cover letters have ever been
 * generated within the period, hide the chart and show a muted CTA linking
 * to /dashboard/resumes.
 */
export function GenerationsCard({
  generationsTotalResumes,
  generationsTotalCoverLetters,
  generationsTimeline,
  period,
}: GenerationsCardProps) {
  const t = useTranslations("analytics");

  const total = generationsTotalResumes + generationsTotalCoverLetters;
  const isEmpty = total === 0;

  const chartConfig: ChartConfig = React.useMemo(
    () => ({
      resumes: { label: t("generations_total_resumes"), color: "var(--chart-2)" },
      cover_letters: {
        label: t("generations_total_cover_letters"),
        color: "var(--chart-1)",
      },
    }),
    [t]
  );

  // Five evenly distributed ticks (start, q1, mid, q3, end). For series of
  // fewer than 5 buckets we fall back to whatever's available.
  const tickValues = React.useMemo(() => {
    const n = generationsTimeline.length;
    if (n === 0) return [] as string[];
    if (n <= 5) return generationsTimeline.map((b) => b.date);
    const idxs = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];
    return idxs.map((i) => generationsTimeline[i].date);
  }, [generationsTimeline]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-[15px] font-medium leading-none tracking-normal">
            {t("generations_title")}
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {t("generations_subtitle")}
          </CardDescription>
        </div>
        {isEmpty ? null : (
          <div className="flex gap-6">
            <TotalBlock
              label={t("generations_total_resumes")}
              value={generationsTotalResumes}
            />
            <TotalBlock
              label={t("generations_total_cover_letters")}
              value={generationsTotalCoverLetters}
            />
            <TotalBlock label={t("generations_total_all")} value={total} />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("generations_empty")}
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/resumes">{t("generations_empty_cta")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart
                data={generationsTimeline}
                margin={{ top: 10, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 4"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="date"
                  ticks={tickValues}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: string) => formatTickForPeriod(value, period)}
                  interval="preserveStartEnd"
                  fontSize={10}
                />
                <YAxis hide />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeDasharray: "2 3" }}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) =>
                        typeof value === "string"
                          ? formatTickForPeriod(value, period)
                          : String(value)
                      }
                    />
                  }
                />
                {/* Bottom layer — resumes. Declared first so it paints under
                    the cover-letter area. */}
                <Area
                  type="monotone"
                  dataKey="resumes"
                  stackId="1"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.9}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cover_letters"
                  stackId="1"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.8}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>

            {/* Legend (custom — recharts default doesn't match the mockup) */}
            <div className="flex gap-6 text-xs text-muted-foreground">
              <LegendItem
                color="var(--chart-2)"
                label={t("generations_total_resumes")}
              />
              <LegendItem
                color="var(--chart-1)"
                label={t("generations_total_cover_letters")}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TotalBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p
        className="text-[10px] uppercase text-muted-foreground"
        style={{ letterSpacing: "0.5px" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[20px] font-medium leading-none">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="rounded-sm"
        style={{
          width: 11,
          height: 11,
          backgroundColor: color,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </span>
  );
}
