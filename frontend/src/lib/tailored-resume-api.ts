/**
 * TailoredResume API client (TAILOR-6/7/8).
 *
 * Mirrors `backend/app/schemas/tailored_resume.py` (`TailoredResumeResponse`)
 * and the routers at:
 *   - POST /api/v1/jobs/{job_id}/tailor                  (jobs.py — tailor_resume)
 *   - POST /api/v1/tailored-resumes/{id}/download        (tailored_resumes.py)
 *
 * GET /api/v1/tailored-resumes/{id} and PATCH /api/v1/tailored-resumes/{id}
 * are NOT YET IMPLEMENTED on the backend. The corresponding helpers below
 * throw a clearly-labeled error so the editor degrades gracefully until the
 * backend lands those endpoints.
 */
import { api } from "./api";
import { parseLimitError, type CreditError, type RateLimitError } from "./api-errors";
import type { ProfileData } from "./profile-api";

// ---------------------------------------------------------------------------
// Types — mirror backend Pydantic schemas
// ---------------------------------------------------------------------------

export interface MatchedKeyword {
  term: string;
  /** Stable 1..8 palette index used by the side panel chips. */
  color_id: number;
}

/** AppliedChanges JSONB shape: `{[section_key]: string[]}`. */
export type AppliedChanges = Record<string, string[]>;

export interface TailoredResume {
  id: string;
  user_id: string;
  job_id: string;
  name: string;

  /** Same shape as ProfileData; AI-tailored. */
  tailored_data: ProfileData;
  /** Frozen-at-generation profile snapshot (immutable). */
  profile_snapshot: ProfileData;

  matched_keywords: MatchedKeyword[];
  applied_changes: AppliedChanges;
  match_score: number;

  sections_order_snapshot: string[];
  font_snapshot: string;
  template_snapshot: string;

  rating_modal_shown_at: string | null;
  /** Star rating (1..5) the user gave this resume — null if not rated. */
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface TailoredResumePatchRequest {
  name?: string;
  tailored_data?: ProfileData;
  sections_order_snapshot?: string[];
  font_snapshot?: string;
}

/**
 * Compact row shape returned by GET /api/v1/tailored-resumes (TAILOR-15).
 *
 * Mirrors backend `TailoredResumeListItem` — the heavy fields (`tailored_data`,
 * `profile_snapshot`, `applied_changes`, `matched_keywords`) are deliberately
 * omitted to keep the list endpoint lean. The list page never reads them.
 *
 * `job_title` / `job_company` are joined from `jobs` so the card subtitle can
 * render without N+1 fetches; `rating` is joined from `ai_quality_ratings`.
 */
export interface TailoredResumeListItem {
  id: string;
  job_id: string;
  name: string;
  match_score: number;
  rating_modal_shown_at: string | null;
  rating: number | null;
  job_title: string | null;
  job_company: string | null;
  created_at: string;
  updated_at: string;
}

export interface TailoredResumeListResponse {
  items: TailoredResumeListItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export type TailorErrorCode =
  | "PROFILE_NOT_READY"
  | "RESUME_ALREADY_EXISTS"
  | "JOB_NOT_FOUND"
  | "AI_UNAVAILABLE"
  | "NOT_IMPLEMENTED"
  | "OUT_OF_QUOTA"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class TailorError extends Error {
  code: TailorErrorCode;
  /**
   * Set on RESUME_ALREADY_EXISTS when the server includes the conflicting
   * resume id in the 409 body.
   *
   * TODO: the backend does not currently return this id (see jobs.py:291).
   * When backend-dev wires it in, parse it here.
   */
  existingResumeId?: string;
  /**
   * MONETIZE-14: when `code === "OUT_OF_QUOTA"`, the parsed credit envelope
   * from `parseLimitError` is attached so the loading page can dispatch the
   * UpgradeModal via `openFromCreditError(err.creditError!)`.
   */
  creditError?: CreditError;
  /**
   * MONETIZE-15: when `code === "RATE_LIMITED"`, the parsed 429 envelope from
   * `parseLimitError` is attached so the loading page can dispatch the
   * RateLimitModal via `openFromRateLimitError(err.rateLimitError!)`. Distinct
   * from `creditError` because upgrading does not lift this limit.
   */
  rateLimitError?: RateLimitError;

  // Positional signature preserved for backwards compatibility — the
  // existing throw sites in this file all pass at most `(code, message,
  // existingResumeId)`. Two new optional positional params (creditError,
  // rateLimitError) are appended so MONETIZE-14/15 wiring can attach the
  // parsed envelope without breaking any existing call site.
  constructor(
    code: TailorErrorCode,
    message: string,
    existingResumeId?: string,
    creditError?: CreditError,
    rateLimitError?: RateLimitError,
  ) {
    super(message);
    this.name = "TailorError";
    this.code = code;
    this.existingResumeId = existingResumeId;
    this.creditError = creditError;
    this.rateLimitError = rateLimitError;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BackendErrorBody {
  detail?:
    | string
    | {
        detail?: string;
        error_code?: string;
        existing_resume_id?: string;
      };
}

async function readBackendError(res: Response): Promise<BackendErrorBody> {
  try {
    return (await res.json()) as BackendErrorBody;
  } catch {
    return {};
  }
}

function extractErrorCode(body: BackendErrorBody): string | undefined {
  if (body.detail && typeof body.detail === "object") {
    return body.detail.error_code;
  }
  return undefined;
}

function extractDetailString(body: BackendErrorBody): string | undefined {
  if (typeof body.detail === "string") return body.detail;
  if (body.detail && typeof body.detail === "object") return body.detail.detail;
  return undefined;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/jobs/{jobId}/tailor → 201 + TailoredResume
 *
 * Maps backend status / error_code to a typed `TailorError`:
 *   - 404                     → JOB_NOT_FOUND
 *   - 409 RESUME_ALREADY_EXISTS → RESUME_ALREADY_EXISTS
 *   - 400 PROFILE_NOT_READY     → PROFILE_NOT_READY
 *   - 502 / 504 / network       → AI_UNAVAILABLE
 *   - anything else            → UNKNOWN
 */
export async function tailorResumeForJob(jobId: string): Promise<TailoredResume> {
  let res: Response;
  try {
    res = await api.post(`/api/v1/jobs/${jobId}/tailor`);
  } catch {
    // Network failure (offline, DNS, etc.)
    throw new TailorError(
      "AI_UNAVAILABLE",
      "AI service is temporarily unavailable. Please try again."
    );
  }

  if (res.ok) {
    return (await res.json()) as TailoredResume;
  }

  // MONETIZE-14 / MONETIZE-15 — handle the standardised 402 (credit) and 429
  // (anti-abuse rate-limit) envelopes BEFORE the legacy 4xx/5xx ladder. We
  // clone the response so `readBackendError(res)` below can still read the
  // body for non-limit errors (`parseLimitError` consumes its argument).
  const limitErr = await parseLimitError(res.clone());
  if (limitErr?.kind === "credit") {
    throw new TailorError(
      "OUT_OF_QUOTA",
      "Resume credits used up.",
      undefined,
      limitErr,
    );
  }
  if (limitErr?.kind === "rate_limit") {
    throw new TailorError(
      "RATE_LIMITED",
      limitErr.message,
      undefined,
      undefined,
      limitErr,
    );
  }

  const body = await readBackendError(res);
  const code = extractErrorCode(body);
  const message = extractDetailString(body) ?? `Tailor failed (HTTP ${res.status})`;

  if (res.status === 404) {
    throw new TailorError("JOB_NOT_FOUND", message);
  }
  if (res.status === 409 || code === "RESUME_ALREADY_EXISTS") {
    // The id field name is speculative (server doesn't return it today).
    // When backend-dev adds it, no caller change required.
    const existingId =
      body.detail && typeof body.detail === "object"
        ? body.detail.existing_resume_id
        : undefined;
    throw new TailorError("RESUME_ALREADY_EXISTS", message, existingId);
  }
  if (res.status === 400 || code === "PROFILE_NOT_READY") {
    throw new TailorError("PROFILE_NOT_READY", message);
  }
  if (res.status === 502 || res.status === 504) {
    throw new TailorError("AI_UNAVAILABLE", message);
  }

  throw new TailorError("UNKNOWN", message);
}

/**
 * GET /api/v1/tailored-resumes/{id} — NOT YET IMPLEMENTED on backend.
 *
 * Throws a typed error so the editor can render its 404 / error state. Once
 * backend-dev adds the route, replace the body with a normal `api.get` call.
 */
export async function getTailoredResume(id: string): Promise<TailoredResume> {
  // TODO(backend): implement GET /api/v1/tailored-resumes/{id} (TAILOR-8 backend gap).
  // For now we attempt the call so the editor will start working
  // automatically the moment the backend lands the route.
  const res = await api.get(`/api/v1/tailored-resumes/${id}`);

  if (res.status === 404) {
    throw new TailorError("JOB_NOT_FOUND", "Resume not found.");
  }
  if (res.status === 405 || res.status === 404) {
    throw new TailorError(
      "NOT_IMPLEMENTED",
      "Resume detail endpoint is not yet implemented on the backend."
    );
  }
  if (!res.ok) {
    throw new TailorError(
      "UNKNOWN",
      `Failed to load resume (HTTP ${res.status}).`
    );
  }
  return (await res.json()) as TailoredResume;
}

/**
 * PATCH /api/v1/tailored-resumes/{id} — NOT YET IMPLEMENTED on backend.
 *
 * Same fallback as `getTailoredResume`: degrades gracefully with a typed
 * error until the backend route exists.
 */
export async function patchTailoredResume(
  id: string,
  patch: TailoredResumePatchRequest
): Promise<TailoredResume> {
  // TODO(backend): implement PATCH /api/v1/tailored-resumes/{id} (TAILOR-8 backend gap).
  const res = await api.patch(`/api/v1/tailored-resumes/${id}`, patch);

  if (res.status === 404) {
    throw new TailorError("JOB_NOT_FOUND", "Resume not found.");
  }
  if (res.status === 405) {
    throw new TailorError(
      "NOT_IMPLEMENTED",
      "Resume update endpoint is not yet implemented on the backend."
    );
  }
  if (!res.ok) {
    const body = await readBackendError(res);
    throw new TailorError(
      "UNKNOWN",
      extractDetailString(body) ?? `Failed to update resume (HTTP ${res.status}).`
    );
  }
  return (await res.json()) as TailoredResume;
}

/**
 * GET /api/v1/tailored-resumes — list user's resumes (TAILOR-15).
 *
 * Returns the lighter `TailoredResumeListItem` shape — list page chrome only.
 * Sorted by `created_at DESC` server-side. Throws on non-2xx.
 */
export async function listTailoredResumes(
  params?: { limit?: number; offset?: number }
): Promise<TailoredResumeListResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const url = `/api/v1/tailored-resumes${qs.toString() ? `?${qs}` : ""}`;
  const res = await api.get(url);
  if (!res.ok) {
    throw new Error(`Failed to list resumes (HTTP ${res.status}).`);
  }
  return (await res.json()) as TailoredResumeListResponse;
}

/**
 * DELETE /api/v1/tailored-resumes/{id} → 204 No Content (TAILOR-14).
 *
 * Throws on non-2xx so the optimistic-update flow in the list page can roll
 * back via React Query's `onError`.
 */
export async function deleteTailoredResume(id: string): Promise<void> {
  const res = await api.delete(`/api/v1/tailored-resumes/${id}`);
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete resume (HTTP ${res.status}).`);
  }
}

/**
 * GET /api/v1/jobs/{jobId}/tailored-resume — does this job have a tailored
 * resume? (TAILOR-16)
 *
 * - 200 → returns the existing `TailoredResume`.
 * - 204 → no resume exists for this job → resolves to `null`.
 * - Anything else (incl. 404) → throws so React Query surfaces an error.
 *
 * Caller (`JobContextMenu`) branches on `null` vs an object to render
 * "Tailor Resume" vs "View Resume".
 */
export async function getTailoredResumeForJob(
  jobId: string
): Promise<TailoredResume | null> {
  const res = await api.get(`/api/v1/jobs/${jobId}/tailored-resume`);
  if (res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch tailored resume (HTTP ${res.status}).`);
  }
  return (await res.json()) as TailoredResume;
}

/**
 * POST /api/v1/tailored-resumes/{id}/download → application/pdf binary stream.
 *
 * The browser-download choreography (anchor + revokeObjectURL) lives at the
 * call site — this just returns the blob.
 */
export async function downloadTailoredResume(id: string): Promise<Blob> {
  const res = await api.post(`/api/v1/tailored-resumes/${id}/download`);
  if (!res.ok) {
    const body = await readBackendError(res);
    throw new Error(
      extractDetailString(body) ??
        `Failed to download resume (HTTP ${res.status}).`
    );
  }
  return res.blob();
}

// ---------------------------------------------------------------------------
// TAILOR-13/14 — Rating modal endpoints
// ---------------------------------------------------------------------------

export interface SubmitRatingPayload {
  rating: number;
  /** null when the comment textarea is hidden (rating ≥ 3) or empty/whitespace. */
  comment: string | null;
}

/**
 * Error thrown by `submitRating` so callers can branch on status. The spec
 * (§5.3) distinguishes 409 (close silently) from 5xx (keep modal open with
 * inline error) — therefore the status code MUST be preserved.
 */
export class RatingSubmitError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RatingSubmitError";
    this.status = status;
  }
}

/**
 * POST /api/v1/tailored-resumes/{id}/rating
 *
 * 201 → resolves.
 * 409 → throws RatingSubmitError(409) — already rated (race with another tab).
 * 5xx / network → throws RatingSubmitError(>=500).
 * Other non-2xx → throws RatingSubmitError(status).
 */
export async function submitRating(
  resumeId: string,
  payload: SubmitRatingPayload
): Promise<void> {
  let res: Response;
  try {
    res = await api.post(
      `/api/v1/tailored-resumes/${resumeId}/rating`,
      payload
    );
  } catch {
    // Network failure — treat as 5xx-equivalent so the caller renders the
    // inline retry error and keeps the modal open.
    throw new RatingSubmitError(0, "Network error while submitting rating.");
  }
  if (res.status === 201 || res.ok) return;

  const body = await readBackendError(res);
  const message =
    extractDetailString(body) ?? `Rating submit failed (HTTP ${res.status}).`;
  throw new RatingSubmitError(res.status, message);
}

/**
 * POST /api/v1/tailored-resumes/{id}/rating-modal-shown
 *
 * Idempotent server-side. Fire-and-forget at the call site — the spec (§1.1)
 * intentionally does not block modal display on this POST. Errors are
 * swallowed: a network failure at second 0 leaves the modal eligible to
 * re-show on next visit (acceptable per §1.2 edge analysis).
 */
export async function markRatingModalShown(resumeId: string): Promise<void> {
  try {
    await api.post(
      `/api/v1/tailored-resumes/${resumeId}/rating-modal-shown`
    );
  } catch {
    // Intentionally swallowed — see docstring.
  }
}
