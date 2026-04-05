import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export interface CurrentSubscription {
  subscription_id: string | null;
  plan_slug: "free" | "pro";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused" | null;
  ai_ops_used: number;
  ai_ops_limit: number;
  active_jobs: number;
  billing_cycle: string | null;
  current_period_end: string | null;
}

async function getCurrentSubscription(): Promise<CurrentSubscription> {
  const res = await api.get("/api/v1/subscriptions/current");
  if (!res.ok) throw new Error(`Failed to fetch subscription: HTTP ${res.status}`);
  return res.json();
}

export function useCurrentSubscription() {
  return useQuery<CurrentSubscription>({
    queryKey: queryKeys.user.subscription,
    queryFn: getCurrentSubscription,
    staleTime: 1000 * 60 * 5,
  });
}
