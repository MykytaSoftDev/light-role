"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  const [state, setState] = useState<PlanState>({
    subscriptionId: null,
    plan: null,
    status: null,
    isFreePlan: false,
    isProPlan: false,
    aiOpsUsed: 0,
    aiOpsLimit: 10,
    activeJobs: 0,
    isLoading: true,
  });

  useEffect(() => {
    api.get("/api/v1/subscriptions/current")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setState({
          subscriptionId: data.subscription_id,
          plan: data.plan_slug,
          status: data.status,
          isFreePlan: data.plan_slug === "free",
          isProPlan: data.plan_slug === "pro",
          aiOpsUsed: data.ai_ops_used ?? 0,
          aiOpsLimit: data.ai_ops_limit ?? 10,
          activeJobs: data.active_jobs ?? 0,
          isLoading: false,
        });
      })
      .catch(() => setState(s => ({ ...s, isLoading: false })));
  }, []);

  return state;
}
