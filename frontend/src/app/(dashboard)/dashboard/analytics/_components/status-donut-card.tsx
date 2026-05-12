"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import type { StatusCount } from "@/lib/types/analytics";

interface StatusDonutCardProps {
  statusBreakdown: StatusCount[];
}

type ActiveStatus = "saved" | "applied" | "screening" | "interview" | "offer";

const STATUS_ORDER: ActiveStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
];

const STATUS_TRANSLATION_KEY: Record<ActiveStatus, string> = {
  saved: "donut_status_saved",
  applied: "donut_status_applied",
  screening: "donut_status_screening",
  interview: "donut_status_interview",
  offer: "donut_status_offer",
};

const STATUS_COLORS: Record<ActiveStatus, string> = {
  saved: "var(--status-saved)",
  applied: "var(--status-applied)",
  screening: "var(--status-screening)",
  interview: "var(--status-interview)",
  offer: "var(--status-offer)",
};

/**
 * Right column of row 3 — donut chart of the active pipeline by status, with
 * a custom HTML legend underneath (recharts' default legend doesn't match the
 * mockup's left-label / right-count layout).
 */
export function StatusDonutCard({ statusBreakdown }: StatusDonutCardProps) {
  const t = useTranslations("analytics");

  // Normalise: filter to the five active statuses, default missing ones to 0.
  const counts = React.useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const row of statusBreakdown) {
      byStatus.set(row.status, row.count);
    }
    return STATUS_ORDER.map((status) => ({
      status,
      label: t(STATUS_TRANSLATION_KEY[status]),
      color: STATUS_COLORS[status],
      count: byStatus.get(status) ?? 0,
    }));
  }, [statusBreakdown, t]);

  const chartConfig: ChartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    for (const s of STATUS_ORDER) {
      cfg[s] = { label: t(STATUS_TRANSLATION_KEY[s]), color: STATUS_COLORS[s] };
    }
    return cfg;
  }, [t]);

  const isEmpty = counts.every((c) => c.count === 0);
  // Recharts won't render the chart cleanly with all-zero values; we also
  // want to drop empty slices so the remaining ones don't carry stale hover
  // regions from zeroed wedges.
  const chartData = counts.filter((c) => c.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-medium leading-none tracking-normal">
          {t("donut_title")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("donut_subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isEmpty ? (
          <div className="flex h-[170px] items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("donut_empty")}</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[170px] w-full"
          >
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}

        {/* Custom HTML legend (always five rows, matches mockup layout). */}
        <div className="flex flex-col gap-2 text-sm">
          {counts.map(({ status, label, color, count }) => (
            <div
              key={status}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
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
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
