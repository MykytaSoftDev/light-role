import { api } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';

export interface SubscriptionLimits {
  ai_operations: number;
  active_jobs: number;
}

export interface SubscriptionUsage {
  ai_operations: number;
  active_jobs: number;
}

export interface EffectiveLimits {
  ai_operations: number;
  /** null means unlimited (Pro plan) */
  active_jobs: number | null;
}

export interface SubscriptionDetail {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  paddle_subscription_id: string | null;
  limits: SubscriptionLimits;
  current_usage: SubscriptionUsage;
  reset_date: string | null;
  /** Resolved plan accounting for active grace periods (e.g. cancelled-but-not-expired) */
  effective_plan: string;
  /** Resolved limits based on effective_plan */
  effective_limits: EffectiveLimits;
}

// ── API call ───────────────────────────────────────────────────────────────

export async function getSubscription(): Promise<SubscriptionDetail> {
  const res = await api.get('/api/v1/subscriptions');
  if (!res.ok) throw new Error('Failed to fetch subscription details');
  return res.json();
}

export async function saveCustomerId(paddleCustomerId: string): Promise<void> {
  const res = await api.patch('/api/v1/subscriptions/customer', {
    paddle_customer_id: paddleCustomerId,
  });
  if (!res.ok) throw new Error('Failed to save customer ID');
}
