import { api } from "./api";
import type { ResumeFont } from "./fonts/resume-fonts";

const apiVersion = "/api/v1"

/**
 * Resume preferences — surfaced on every `GET /api/v1/users/me` (PREFS-1).
 * Mirrors the backend `ResumePreferences` schema. The full triple is always
 * present on read; writes are partial via PATCH /users/me/resume-preferences.
 */
export interface ResumePreferences {
  /** The 9 reorderable section keys in user-chosen order. */
  sections_order: string[];
  /** One of the 5 supported resume fonts. Stored as the canonical string. */
  font: ResumeFont;
  /** Locked to "classic" in MVP; backend rejects other values with 400. */
  template: string;
}

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
  /** PREFS-1: required field; backend always returns a populated object. */
  resume_preferences: ResumePreferences
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

/**
 * Validation error from the backend resume-preferences endpoint. Carries
 * the HTTP status so the caller can pick the right toast string (422 = bad
 * shape from a client UI bug; 400 = locked-key violation; 5xx/network = retry).
 */
export class ResumePreferencesError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ResumePreferencesError";
    this.status = status;
  }
}

/**
 * PATCH /api/v1/users/me/resume-preferences — PREFS-1.
 *
 * Partial update. The body MUST contain at least one of `sections_order` or
 * `font`. Sending only `template` (or empty) returns 400. The response is the
 * full merged `ResumePreferences` object.
 *
 * Reject conditions (backend):
 *   - empty body → 400
 *   - `font` not in KNOWN_FONTS → 422
 *   - `sections_order` not a permutation of the 9 known keys → 422
 *   - `template` present and not "classic" → 400
 */
export async function updateResumePreferences(
  body: Partial<Pick<ResumePreferences, "sections_order" | "font">>
): Promise<ResumePreferences> {
  const res = await api.patch(
    `${apiVersion}/users/me/resume-preferences`,
    body
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data === "object" && "detail" in data) {
        message =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // Body wasn't JSON — keep the generic HTTP message.
    }
    throw new ResumePreferencesError(message, res.status);
  }
  return res.json();
}
