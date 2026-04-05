"use client";
import { useCurrentSubscription } from "@/hooks/api/useCurrentSubscription";

interface PlanState {
  subscriptionId: string | null;
  plan: string | null;       // "free" | "pro"
  status: string | null;     // "active" | "cancelled" | "past_due"
  isFreePlan: boolean;
  isProPlan: boolean;
  aiOpsUsed: number;
  aiOpsLimit: number;
  activeJobs: number;
  isLoading: boolean;
}

export function usePlan(): PlanState {
  const { data, isPending } = useCurrentSubscription();

  return {
    subscriptionId: data?.subscription_id ?? null,
    plan: data?.plan_slug ?? null,
    status: data?.status ?? null,
    isFreePlan: data?.plan_slug === "free",
    isProPlan: data?.plan_slug === "pro",
    aiOpsUsed: data?.ai_ops_used ?? 0,
    aiOpsLimit: data?.ai_ops_limit ?? 10,
    activeJobs: data?.active_jobs ?? 0,
    isLoading: isPending,
  };
}
