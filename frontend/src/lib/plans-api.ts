import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  slug: "free" | "pro";
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  paddle_price_id_monthly: string | null;
  paddle_price_id_annual: string | null;
  features_json: string[];
  ai_operations_limit: number | null;
  active_jobs_limit: number | null;
  is_active: boolean;
}

// ── API call ───────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const res = await api.get("/api/v1/plans");
  if (!res.ok) throw new Error("Failed to fetch plans");
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? []);
}
