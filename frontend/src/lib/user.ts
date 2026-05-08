import { api } from "./api";

const apiVersion = "/api/v1"

export interface CurrentUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string,
  auth_provider: "google" | "email",
  is_verified: boolean,
  onboarding_completed: boolean,
  created_at: string,
  /**
   * Set when the user has dismissed the dashboard "Get Started" panel
   * (DASHBOARD-1). `null`/absent means the panel is still eligible to
   * appear. Server-side timestamp; one-way switch.
   */
  complete_steps_dismissed_at?: string | null
}

export interface DismissCompleteStepsResponse {
  complete_steps_dismissed_at: string;
}

// ── API call ───────────────────────────────────────────────────────────────

export async function getUserData(): Promise<CurrentUser> {
  const res = await api.get(`${apiVersion}/users/me`);
  if (!res.ok) throw new Error("auth");
  return res.json();
}

export async function logout() {
  const res = await api.post(`${apiVersion}/auth/logout`)
  return res.json
}

/**
 * POST /api/v1/users/me/dismiss-complete-steps — DASHBOARD-1.
 *
 * Idempotent: the server returns 200 with the existing timestamp if the user
 * has already dismissed before. The dashboard treats any successful response
 * as "panel hidden going forward".
 */
export async function dismissCompleteSteps(): Promise<DismissCompleteStepsResponse> {
  const res = await api.post(`${apiVersion}/users/me/dismiss-complete-steps`, {});
  if (!res.ok) throw new Error(`Failed to dismiss complete steps: HTTP ${res.status}`);
  return res.json();
}
