import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export interface Plan {
  id: string;
  name: string;
  slug: "free" | "pro";
  description: string | null;
  paddle_price_id_monthly: string | null;
  paddle_price_id_annual: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  max_active_jobs: number;
  max_ai_ops_monthly: number;
  max_resume_templates: number;
  has_analytics: boolean;
  has_priority_ai: boolean;
  features_json: unknown[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PlansResponse {
  data: Plan[];
}

async function getPlans(): Promise<Plan[]> {
  const res = await api.get("/api/v1/plans");
  if (!res.ok) throw new Error(`Failed to fetch plans: HTTP ${res.status}`);
  const json: PlansResponse = await res.json();
  return json.data;
}

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: queryKeys.plans.all,
    queryFn: getPlans,
    staleTime: Infinity,
  });
}
