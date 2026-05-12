"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DailyActivity } from "@/lib/types/analytics";

interface ActivityHeatmapProps {
  /** 91 entries, oldest → newest. Today should be the last element. */
  data: DailyActivity[];
  className?: string;
}

/**
 * Map a daily application count to the matching heat CSS variable.
 *  - 0     → heat-0 (empty/muted)
 *  - 1     → heat-1
 *  - 2–3   → heat-2
 *  - 4–5   → heat-3
 *  - 6+    → heat-4
 */
function heatVar(count: number): string {
  if (count <= 0) return "var(--heat-0)";
  if (count === 1) return "var(--heat-1)";
  if (count <= 3) return "var(--heat-2)";
  if (count <= 5) return "var(--heat-3)";
  return "var(--heat-4)";
}

/**
 * 13×7 calendar-style activity heatmap.
 *
 * Layout:
 *  - CSS grid, 13 columns × 7 rows (= 91 cells), 3px gap.
 *  - Today sits in the bottom-right corner. Walking backwards from there, cells
 *    are placed column-major (top-to-bottom within a column, right-to-left
 *    across columns). So column 0/row 0 is ~91 days ago; column 12/row 6 is
 *    today.
 *  - Each cell carries a native `title` for hover tooltip.
 *
 * The component is intentionally generic (no analytics-only imports beyond
 * the `DailyActivity` type) so it can be reused on a future profile/history
 * page.
 */
export function ActivityHeatmap({ data, className }: ActivityHeatmapProps) {
  const t = useTranslations("analytics");

  // Sort the input oldest → newest just in case the caller passes an
  // unsorted array. We do this once via useMemo to keep render cheap.
  const sorted = React.useMemo(() => {
    return [...data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [data]);

  // Pad / trim to exactly 91 entries so the grid is always full.
  const padded = React.useMemo(() => {
    if (sorted.length === 91) return sorted;
    if (sorted.length > 91) return sorted.slice(-91);
    // Pad with empty days at the beginning so the latest entry stays at the
    // end (= bottom-right corner of the grid).
    const placeholdersNeeded = 91 - sorted.length;
    const placeholders: DailyActivity[] = Array.from(
      { length: placeholdersNeeded },
      () => ({ date: "", count: 0 })
    );
    return [...placeholders, ...sorted];
  }, [sorted]);

  // Place cells column-major so today (last input) is in the bottom-right.
  //
  //   cellIndex in DOM (row-major):
  //     row r, col c  →  r * 13 + c
  //
  //   day index (column-major from oldest top-left to today bottom-right):
  //     col c, row r  →  c * 7 + r  (0..90)
  //
  // We render row-major (the natural CSS-grid order) but compute the day
  // index per DOM cell.
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 13; c++) {
      const dayIndex = c * 7 + r;
      const day = padded[dayIndex];
      const count = day?.count ?? 0;
      const dateStr = day?.date ?? "";
      const title = dateStr ? `${dateStr}: ${count} ${t("streak_count_suffix")}` : "";
      cells.push(
        <div
          key={`${r}-${c}`}
          title={title}
          aria-label={title || undefined}
          style={{
            backgroundColor: heatVar(count),
            borderRadius: 2,
            aspectRatio: "1 / 1",
          }}
        />
      );
    }
  }

  return (
    <div
      className={cn("grid w-full gap-[3px]", className)}
      style={{
        gridTemplateColumns: "repeat(13, 1fr)",
        gridTemplateRows: "repeat(7, 1fr)",
      }}
      role="img"
      aria-label={t("streak_label")}
    >
      {cells}
    </div>
  );
}

export { heatVar };
