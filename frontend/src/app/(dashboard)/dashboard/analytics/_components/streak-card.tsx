"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DailyActivity, PersonalBest } from "@/lib/types/analytics";

import { ActivityHeatmap } from "./activity-heatmap";

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  dailyActivity: DailyActivity[];
  personalBest: PersonalBest | null;
}

/**
 * Render a short locale-agnostic date range like "15–21 Mar" / "28 Mar – 3 Apr".
 * Switches to single-month form when both bounds share a month. The format
 * itself is date-fns en-locale output; per-locale month names is a follow-up.
 */
function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = parseISO(startIso);
    const end = parseISO(endIso);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${format(start, "d")}–${format(end, "d MMMM")}`;
    }
    return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

/**
 * Right column of row 1. Big streak number, 13-week heatmap, and a personal
 * best section at the bottom (hidden when `personalBest === null`).
 *
 * Empty state: when the user has no activity at all (streak=0 and every
 * heatmap day is zero), show a centered hint instead of the streak number.
 * The heatmap still renders (as all heat-0 cells) to communicate the period
 * span.
 */
export function StreakCard({
  currentStreak,
  longestStreak: _longestStreak,
  dailyActivity,
  personalBest,
}: StreakCardProps) {
  const t = useTranslations("analytics");

  // `longestStreak` is in the props for future use. Reference it once so
  // TS strict noUnusedParameters stays happy.
  void _longestStreak;

  const isCompletelyEmpty =
    currentStreak === 0 && dailyActivity.every((d) => d.count === 0);

  return (
    <Card className="lg:col-span-1">
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Top: label + big streak number */}
        <div>
          <p className="text-xs text-muted-foreground">{t("streak_label")}</p>
          {isCompletelyEmpty ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("streak_empty")}
            </p>
          ) : (
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="font-medium leading-none"
                style={{ fontSize: "44px" }}
              >
                {currentStreak}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("streak_unit")}
              </span>
            </div>
          )}
        </div>

        {/* Heatmap */}
        <ActivityHeatmap data={dailyActivity} className="mt-1" />

        {/* Heatmap footer: 13 weeks label + colour ramp legend */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("streak_footer")}</span>
          <div className="flex items-center gap-1">
            <span>{t("streak_less")}</span>
            {(["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"] as const).map(
              (cssVar) => (
                <span
                  key={cssVar}
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: `var(${cssVar})`,
                    display: "inline-block",
                  }}
                />
              )
            )}
            <span>{t("streak_more")}</span>
          </div>
        </div>

        {/* Personal best — hidden entirely when null */}
        {personalBest ? (
          <>
            <Separator />
            <div className="flex items-start gap-3">
              <Trophy
                className="h-5 w-5 shrink-0"
                style={{ color: "var(--status-interview)" }}
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("streak_best_label")}
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {formatDateRange(personalBest.start_date, personalBest.end_date)}
                  {" · "}
                  {personalBest.count} {t("streak_count_suffix")}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
