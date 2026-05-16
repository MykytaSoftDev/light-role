"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ExcitementStars — read-only 5-star excitement display for kanban job cards.
//
// Bound to `application.excitement_level` (0..5, nullable). Returns null when
// level is null/0 so the card geometry stays tight (no empty placeholder row).
// Used only for display — see /dashboard/jobs/[id] StarRating for the editable
// version on the job details page.
// ---------------------------------------------------------------------------

interface ExcitementStarsProps {
  level: number | null;
  className?: string;
}

export function ExcitementStars({ level, className }: ExcitementStarsProps) {
  if (!level || level < 1) return null;
  const count = Math.min(5, Math.max(1, Math.round(level)));
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`Excitement ${count} of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < count
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40"
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
