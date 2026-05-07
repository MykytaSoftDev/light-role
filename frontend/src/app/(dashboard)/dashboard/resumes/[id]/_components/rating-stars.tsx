"use client";

/**
 * TAILOR-13 — 5-star rating control with full keyboard support.
 *
 * Spec: docs/v2/specs/rating-card-spec.md §3 (supersedes the deleted
 * rating-modal-spec.md).
 *
 * Behavior:
 *   - Click / tap a star to set rating (1-based 1..5).
 *   - Hover ramp: stars 1..N fill on hover where N is the hovered index;
 *     stars > N revert to unfilled.
 *   - Roving-tabindex: only the currently-selected star (or star 1 when
 *     `rating === 0`) is in the tab order. Arrow keys move within the group.
 *   - Numeric keys 1-5 set rating directly. Enter / Space activate the
 *     focused star (mirrors click).
 *   - ARIA: `role="radiogroup"` on the container, `role="radio"` +
 *     `aria-checked` on each star.
 *   - Disabled state: `pointer-events-none`, focus trap removed, hover
 *     suppressed. Used while a submit is in flight.
 *
 * Color: filled stars use `fill-primary text-primary`; unfilled use
 * `text-muted-foreground`. No rating-value-based color coding (see spec §3.5).
 */
import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Current rating value (0..5). 0 means no selection. */
  value: number;
  /** Called when the user changes the rating. Receives 1..5. */
  onChange: (rating: number) => void;
  /** When true, the control is non-interactive (used while submitting). */
  disabled?: boolean;
  /**
   * Star icon size. Defaults to "md" (h-9 w-9, the modal-era size kept for
   * backward compat). The card surface uses "sm" (h-7 w-7) to fit the 320px
   * side-panel column. See rating-card-spec.md §7.2.
   */
  size?: "sm" | "md";
}

const STARS = [1, 2, 3, 4, 5] as const;

export function RatingStars({
  value,
  onChange,
  disabled,
  size = "md",
}: RatingStarsProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number>(0);
  const buttonsRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  // The "active" index for visual fill: hover takes precedence, else value.
  const activeIndex = hoverIndex > 0 ? hoverIndex : value;

  // The star that owns the tab stop (roving tabindex). When `value === 0`,
  // tabbing in lands on star 1.
  const tabIndexOwner = value > 0 ? value : 1;

  const focusStar = React.useCallback((index: number) => {
    const clamped = Math.max(1, Math.min(5, index));
    buttonsRef.current[clamped - 1]?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Numeric shortcuts work anywhere in the group.
    if (e.key >= "1" && e.key <= "5") {
      e.preventDefault();
      const n = Number(e.key);
      onChange(n);
      focusStar(n);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(5, (value || 0) + 1 || 1);
      onChange(next);
      focusStar(next);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(1, (value || 1) - 1);
      onChange(next);
      focusStar(next);
      return;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Rate this resume"
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHoverIndex(0)}
      className={cn(
        "flex justify-center gap-3",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      {STARS.map((i) => {
        const filled = i <= activeIndex;
        const isOwner = i === tabIndexOwner;
        return (
          <button
            key={i}
            ref={(el) => {
              buttonsRef.current[i - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} out of 5`}
            tabIndex={isOwner ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(i);
            }}
            onMouseEnter={() => setHoverIndex(i)}
            onFocus={() => {
              // Keep hover ramp in sync with focus for keyboard users so
              // the visual fill matches the focused star while arrowing.
              setHoverIndex(i);
            }}
            onBlur={() => setHoverIndex(0)}
            className={cn(
              "rounded-sm p-1 transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "focus-visible:ring-offset-background"
            )}
          >
            <Star
              className={cn(
                "transition-colors",
                size === "sm" ? "h-7 w-7" : "h-9 w-9",
                filled
                  ? "fill-primary text-primary"
                  : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
