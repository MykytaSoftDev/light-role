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
  created_at: string;
  updated_at: string;
}

export interface TailoredResumePatchRequest {
  name?: string;
  tailored_data?: ProfileData;
  sections_order_snapshot?: string[];
  font_snapshot?: string;
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

  constructor(code: TailorErrorCode, message: string, existingResumeId?: string) {
    super(message);
    this.name = "TailorError";
    this.code = code;
    this.existingResumeId = existingResumeId;
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
