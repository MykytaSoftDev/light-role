"use client";

import { useState } from "react";
import type { RateLimitError } from "@/lib/api-errors";

// ---------------------------------------------------------------------------
// MONETIZE-15 — anti-abuse rate-limit modal state.
//
// Mirrors `useUpgradeModal` (MONETIZE-14) but for HTTP 429 / `AI_RATE_LIMIT`.
// Kept separate because rate-limiting is NOT lifted by upgrading — the modal
// has different copy and a single "Got it" CTA per PRD §12.6.
//
// Each call site that hits an AI endpoint instantiates its own hook and
// dispatches via `openFromRateLimitError(parsed)` after `parseLimitError`
// returns `{ kind: "rate_limit" }`.
// ---------------------------------------------------------------------------

export interface RateLimitModalState {
  open: boolean;
  retryAt?: string;
}

export function useRateLimitModal() {
  const [modalState, setModalState] = useState<RateLimitModalState | null>(null);

  function openFromRateLimitError(err: RateLimitError): void {
    setModalState({ open: true, retryAt: err.retryAt });
  }

  function close() {
    setModalState(null);
  }

  return { modalState, openFromRateLimitError, close };
}
