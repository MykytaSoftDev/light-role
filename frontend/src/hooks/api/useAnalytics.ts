import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { AnalyticsResponse, AnalyticsPeriod } from "@/lib/types/analytics";

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
    throw new Error(`Failed to fetch analytics: HTTP ${res.status}`);
  }
  return res.json();
}

export function useAnalytics(period: AnalyticsPeriod) {
  return useQuery<AnalyticsResponse, AnalyticsError>({
    queryKey: queryKeys.analytics.detail(period),
    queryFn: () => fetchAnalytics(period),
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (error?.status === 402) return false;
      return failureCount < 2;
    },
  });
}
