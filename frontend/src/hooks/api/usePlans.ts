import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

// PRD 6.8 three-tier monetization. The backend `plans` table column was renamed
// `slug → code` in migration 014; `GET /api/v1/plans` returns `code` directly
// (see `backend/app/schemas/plan.py::PlanResponse`).
export type PlanCode = "free" | "pro" | "unlimited";

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  paddle_price_id_monthly: string | null;
  paddle_price_id_annual: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  // NULL = unlimited (matches backend NULL semantics).
  max_active_jobs: number | null;
  resume_credits_per_cycle: number | null;
  cl_credits_per_cycle: number | null;
  analytics_enabled: boolean;
  display_order: number;
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
