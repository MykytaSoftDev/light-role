// ---------------------------------------------------------------------------
// Relative-time formatter for the analytics activity feed.
//
// Returns short relative strings matching the mockup brevity: "just now",
// "1h ago", "yesterday", "3 days ago", "2 weeks ago", "5 months ago".
// SPEC §5.6 specifies this brevity — date-fns' `formatDistanceToNow` is
// intentionally NOT used (it adds "about" prefixes and uses long forms).
//
// The function is i18n-aware: pass a `t` function from `useTranslations`
// (any namespace that exposes the `time_*` keys) and the locale-appropriate
// string comes back.
// ---------------------------------------------------------------------------

import {
  differenceInDays,
  differenceInHours,
  differenceInMonths,
  differenceInWeeks,
} from "date-fns";

/**
 * Minimal subset of the next-intl translator signature we depend on.
 * Accepts an optional values map for ICU interpolation of `{n}`.
 */
export type TranslatorFn = (key: string, values?: Record<string, string | number>) => string;

/**
 * Format a past timestamp as a short relative string using the supplied
 * translator.
 *
 * Required translation keys (under whatever namespace the translator wraps):
 *  - time_just_now
 *  - time_hours_ago        (uses `{n}`)
 *  - time_yesterday
 *  - time_days_ago         (uses `{n}`)
 *  - time_weeks_ago        (uses `{n}`)
 *  - time_months_ago       (uses `{n}`)
 *
 * Buckets:
 *  - < 1 hour    → time_just_now
 *  - < 24 hours  → time_hours_ago        ({n} = hours)
 *  - exactly 1d  → time_yesterday
 *  - < 30 days   → time_days_ago         ({n} = days)
 *  - < 8 weeks   → time_weeks_ago        ({n} = weeks)
 *  - else        → time_months_ago       ({n} = months)
 *
 * Future dates (clock skew, optimistic UI) fall through to "just now"
 * since all diffs go negative.
 */
export function formatRelativeTime(
  date: Date | string,
  t: TranslatorFn
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const hours = differenceInHours(now, d);
  if (hours < 1) return t("time_just_now");
  if (hours < 24) return t("time_hours_ago", { n: hours });

  const days = differenceInDays(now, d);
  if (days === 1) return t("time_yesterday");
  if (days < 30) return t("time_days_ago", { n: days });

  const weeks = differenceInWeeks(now, d);
  if (weeks < 8) return t("time_weeks_ago", { n: weeks });

  const months = differenceInMonths(now, d);
  return t("time_months_ago", { n: months });
}
