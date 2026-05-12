import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { AnalyticsResponse, AnalyticsPeriod } from "@/lib/types/analytics";

/**
 * Custom error thrown by `fetchAnalytics` so callers can branch on the HTTP
 * status — currently only 402 (Pro required) is distinguished from generic
 * failures (which hit the React Query error path).
 */
export interface AnalyticsError extends Error {
  status: number;
}

async function fetchAnalytics(period: AnalyticsPeriod): Promise<AnalyticsResponse> {
  const res = await api.get(`/api/v1/analytics?period=${period}`);
  if (res.status === 402) {
    const err = new Error("Pro subscription required to access analytics") as AnalyticsError;
    err.status = 402;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Failed to fetch analytics: HTTP ${res.status}`) as AnalyticsError;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Single-roundtrip analytics fetch for the redesigned dashboard. The response
 * payload matches the new `AnalyticsResponse` shape (SPEC §3.1) and feeds
 * every block on `/dashboard/analytics`.
 *
 * - `staleTime: 30s` — matches the page's perceived freshness target.
 * - `gcTime: 5m` — aligns with the backend's Redis cache TTL so we don't keep
 *   stale rows around longer than the server's own snapshot.
 * - 402 errors short-circuit retry so the upgrade overlay paints immediately
 *   for Free-tier users.
 * - The query key includes `period`, so switching periods (via the tabs in
 *   AnalyticsHeader) refetches with a fresh request — no manual invalidation
 *   needed.
 */
export function useAnalytics(period: AnalyticsPeriod) {
  return useQuery<AnalyticsResponse, AnalyticsError>({
    queryKey: queryKeys.analytics.detail(period),
    queryFn: () => fetchAnalytics(period),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (error?.status === 402) return false;
      return failureCount < 2;
    },
  });
}
