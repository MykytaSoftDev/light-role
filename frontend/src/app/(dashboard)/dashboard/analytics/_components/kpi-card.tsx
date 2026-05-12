"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Sparkline } from "./sparkline";

interface KpiCardProps {
  /** Lucide icon component reference (not an instance). */
  icon: LucideIcon;
  /** Display label, e.g. "Сохранено". */
  label: string;
  /** Current metric value. */
  current: number;
  /** Period-over-period delta. */
  delta: number;
  /** Exactly 7 ints; passed straight to <Sparkline>. */
  sparkline: number[];
}

/**
 * Compact KPI cell with sparkline. Lives inside the row-2 strip.
 *
 * Per SPEC §5.3 this is a custom `div` (NOT a shadcn `Card`) — the strip uses
 * `bg-muted` with rounded-md corners, no border. Padding is 14px top, 16px
 * sides, 10px bottom (`p-3.5 pb-2.5` in Tailwind 4 spacing).
 *
 * Delta rules:
 *  - Positive → `+N` in `var(--success)` color.
 *  - Zero     → entirely omitted.
 *  - Negative → `−N` (U+2212) in muted-foreground. We deliberately avoid red
 *               so the strip doesn't punish negative deltas — they're a hint,
 *               not a warning.
 */
export function KpiCard({
  icon: Icon,
  label,
  current,
  delta,
  sparkline,
}: KpiCardProps) {
  const deltaNode = React.useMemo(() => {
    if (delta === 0) return null;
    if (delta > 0) {
      return (
        <span
          className="text-xs font-medium"
          style={{ color: "var(--success)" }}
        >
          +{delta}
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-muted-foreground">
        −{Math.abs(delta)}
      </span>
    );
  }, [delta]);

  return (
    <div className="bg-muted rounded-md p-3.5 pb-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-medium leading-none"
          style={{ fontSize: "26px" }}
        >
          {current}
        </span>
        {deltaNode}
      </div>
      {/* Empty-state guard (SPEC §9.5): a card showing 0 stays quiet — no
          flat sparkline at the bottom to imply "trending nothing". */}
      {current === 0 ? null : <Sparkline data={sparkline} className="mt-1" />}
    </div>
  );
}
