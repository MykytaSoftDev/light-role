"use client";

import { useTranslations } from "next-intl";
import type { TimelineMonth } from "@/lib/types/analytics";
import Link from "next/link";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";

interface ApplicationsTimelineProps {
  timeline: TimelineMonth[];
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function ApplicationsTimeline({ timeline }: ApplicationsTimelineProps) {
  const t = useTranslations("analytics");

  const recent = timeline.slice(-6);
  const maxCount = Math.max(...recent.map((m) => m.count), 1);

  if (recent.length === 0 || recent.every((m) => m.count === 0)) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("timeline_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("timeline_empty")}</p>
        <Link
          href={DASHBOARD_PAGES.JOBS}
          className="text-sm text-primary font-medium hover:underline w-fit"
        >
          {t("timeline_empty_cta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold">{t("timeline_title")}</h2>

      <div className="flex items-end gap-2 h-36">
        {recent.map((month) => {
          const heightPct = Math.max((month.count / maxCount) * 100, 4);
          return (
            <div
              key={month.month}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${formatMonth(month.month)}: ${month.count}`}
            >
              <span className="text-xs text-muted-foreground">{month.count}</span>
              <div
                className="w-full rounded-t-md bg-indigo-500 transition-all duration-500"
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatMonth(month.month)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
