// Parses backend 402 (credit/limit) and 429 (rate-limit) error envelopes into
// typed shapes consumed by call sites to decide which modal to open.
// The backend wraps these under FastAPI `HTTPException(detail=...)`, so the
// JSON body is `{ detail: { error_code, ... } }`.
//
// Phase 5.1 standardised the codes (see backend/app/exceptions.py and
// backend/app/middleware/rate_limit.py); ANALYTICS_PAYWALL is reserved for
// the analytics gating work and is not yet emitted server-side.

export type CreditErrorCode =
  | "RESUME_CREDITS_EXCEEDED"
  | "CL_CREDITS_EXCEEDED"
  | "ACTIVE_JOBS_EXCEEDED"
  | "ANALYTICS_PAYWALL";

export interface CreditError {
  kind: "credit";
  errorCode: CreditErrorCode;
  currentCount: number;
  planLimit: number;
  planCode: string;
  resetAt?: string;
  upgradeUrl: string;
}

export interface RateLimitError {
  kind: "rate_limit";
  errorCode: "AI_RATE_LIMIT";
  retryAt: string;
  retryAfterSeconds: number;
  message: string;
}

export type LimitError = CreditError | RateLimitError;

/** Parse a non-OK Response into a LimitError when applicable.
 *  Returns null when the response is not a structured limit error
 *  (e.g. 500, 404, or 402/429 with unrecognised payload).
 *  Note: this function consumes the response body — only call it once
 *  per Response. */
export async function parseLimitError(res: Response): Promise<LimitError | null> {
  if (res.status !== 402 && res.status !== 429) return null;
  let payload: any;
  try {
    payload = await res.json();
  } catch {
    return null;
  }
  const detail = payload?.detail;
  if (!detail || !detail.error_code) return null;

  if (res.status === 402) {
    const code = detail.error_code as CreditErrorCode;
    if (
      code !== "RESUME_CREDITS_EXCEEDED" &&
      code !== "CL_CREDITS_EXCEEDED" &&
      code !== "ACTIVE_JOBS_EXCEEDED" &&
      code !== "ANALYTICS_PAYWALL"
    ) return null;
    return {
      kind: "credit",
      errorCode: code,
      currentCount: detail.current_count ?? 0,
      planLimit: detail.plan_limit ?? 0,
      planCode: detail.plan_code ?? "free",
      resetAt: detail.reset_at,
      upgradeUrl: detail.upgrade_url ?? "/dashboard/upgrade",
    };
  }

  // 429
  if (detail.error_code !== "AI_RATE_LIMIT") return null;
  return {
    kind: "rate_limit",
    errorCode: "AI_RATE_LIMIT",
    retryAt: detail.retry_at,
    retryAfterSeconds: detail.retry_after_seconds ?? 0,
    message: detail.message ?? "Too many AI generations. Try again later.",
  };
}
