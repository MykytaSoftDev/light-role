import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { PlanCode } from "./usePlans";

// Mirrors backend `SubscriptionCurrentResponse` (see `backend/app/schemas/paddle.py`).
// Phase 5.1 added `unlimited` plan; nested `next_payment` / `payment_method` /
// `scheduled_change` are optional and only populated for active paid subscriptions.

export interface PaymentMethod {
  type: string; // "card", "paypal", etc.
  last4?: string | null;
  brand?: string | null;
}

export interface NextPayment {
  amount?: string | null;
  currency?: string | null;
  date?: string | null;
}

export interface CurrentSubscription {
  subscription_id: string | null;
  customer_id?: string | null;
  plan_slug: PlanCode;
  plan_name?: string;
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused" | null;
  billing_cycle?: string | null; // "monthly" | "annual"
  current_period_start?: string | null;
  current_period_end: string | null;
  next_payment?: NextPayment | null;
  payment_method?: PaymentMethod | null;
  scheduled_change?: Record<string, unknown> | null;
  started_at?: string | null;
  ai_ops_used: number;
  ai_ops_limit: number;
  active_jobs: number;
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
