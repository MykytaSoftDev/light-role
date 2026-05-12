"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Exactly 7 numeric values, oldest → newest. */
  data: number[];
  className?: string;
}

// SVG viewBox dimensions. The component is rendered with
// preserveAspectRatio="none" so the X scale stretches to the container while
// the Y scale stays fixed at 28 logical units.
const VIEW_W = 100;
const VIEW_H = 28;
const PAD_Y = 2; // top/bottom inner padding so dots/strokes don't clip.

/**
 * Convert a normalised list of {x, y} points into a smooth Catmull-Rom path
 * expressed as SVG cubic Bezier (`C`) commands. Tension is fixed at the
 * canonical Catmull-Rom value (no parameter) — the data is already noisy
 * enough that we want full smoothing.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x},${p.y}`;
  }

  const commands: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    // Catmull-Rom → Cubic Bezier control points.
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    commands.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return commands.join(" ");
}

/**
 * Tiny inline SVG sparkline. Always 28px tall, stretches to container width.
 *
 * - Stroke uses `var(--chart-1)` (1.5 logical units in viewBox space).
 * - Area below the curve filled at 0.15 opacity.
 * - Flat input (all same value, including all zero) renders a horizontal line
 *   at the middle of the viewBox to avoid an empty look.
 *
 * Path is a Catmull-Rom-to-Bezier smoothing over the 7 input points. No
 * library — the math is ~20 LOC.
 */
export function Sparkline({ data, className }: SparklineProps) {
  // Defensive: always coerce to length 7. Excess values are sliced; short
  // arrays are zero-padded so the X spacing stays predictable.
  const safe = React.useMemo<number[]>(() => {
    if (data.length === 7) return data;
    if (data.length > 7) return data.slice(-7);
    return [...Array(7 - data.length).fill(0), ...data];
  }, [data]);

  const { strokePath, areaPath } = React.useMemo(() => {
    const min = Math.min(...safe);
    const max = Math.max(...safe);
    const usableH = VIEW_H - PAD_Y * 2;

    // Flat data → draw a flat line in the middle of the viewBox.
    const isFlat = max === min;

    const points = safe.map((value, i) => {
      const x = (i / (safe.length - 1)) * VIEW_W;
      const y = isFlat
        ? VIEW_H / 2
        : VIEW_H - PAD_Y - ((value - min) / (max - min)) * usableH;
      return { x, y };
    });

    const smooth = buildSmoothPath(points);
    // Area path = smooth curve, then drop to the baseline and close.
    const lastX = points[points.length - 1]?.x ?? VIEW_W;
    const firstX = points[0]?.x ?? 0;
    const area = `${smooth} L ${lastX},${VIEW_H} L ${firstX},${VIEW_H} Z`;
    return { strokePath: smooth, areaPath: area };
  }, [safe]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
      style={{ height: 28 }}
      aria-hidden="true"
    >
      <path d={areaPath} fill="var(--chart-1)" opacity={0.15} />
      <path
        d={strokePath}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
