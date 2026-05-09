import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

// Mirrors backend `UsageResponse` (see `backend/app/schemas/usage.py`).
// Limit fields use `-1 = unlimited` consistently; `active_jobs` uses `null = unlimited`
// to mirror the underlying plan column.

export interface EffectiveLimits {
  ai_operations: number;
  active_jobs: number | null;
  resume_credits: number; // -1 = unlimited
  cl_credits: number; // -1 = unlimited
}

export interface UsageResponse {
  ai_operations_used: number;
  ai_operations_limit: number;
  effective_plan: string;
  effective_limits: EffectiveLimits;
  reset_date: string;
  active_jobs_count: number;
  applications_this_month: number;
  resume_credits_used: number;
  resume_credits_limit: number; // -1 = unlimited
  cl_credits_used: number;
  cl_credits_limit: number; // -1 = unlimited
  days_until_reset: number;
  plan_name: string | null;
}

export function useUsage() {
  return useQuery<UsageResponse>({
    queryKey: queryKeys.user.usage,
    queryFn: async () => {
      const res = await api.get("/api/v1/users/me/usage");
      if (!res.ok) throw new Error(`Failed to fetch usage: HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute — usage changes mid-session
  });
}
