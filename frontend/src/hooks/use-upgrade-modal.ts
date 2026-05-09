"use client";

import { useState } from "react";
import type { CreditError, CreditErrorCode } from "@/lib/api-errors";

// MONETIZE-14 — modal state is keyed on PRD 12.16 reason codes. The hook is a
// thin wrapper around `useState`; callers dispatch via `openFromCreditError`
// (which destructures a parsed 402 envelope from `parseLimitError`) or via
// `openAnalyticsPaywall` for the gated /analytics route.

export interface UpgradeModalState {
  open: boolean;
  reason: CreditErrorCode;
  currentCount?: number;
  planLimit?: number;
  resetAt?: string;
  planCode?: string;
}

export function useUpgradeModal() {
  const [modalState, setModalState] = useState<UpgradeModalState | null>(null);

  function openFromCreditError(err: CreditError): void {
    setModalState({
      open: true,
      reason: err.errorCode,
      currentCount: err.currentCount,
      planLimit: err.planLimit,
      resetAt: err.resetAt,
      planCode: err.planCode,
    });
  }

  function openAnalyticsPaywall(): void {
    setModalState({ open: true, reason: "ANALYTICS_PAYWALL" });
  }

  function close() {
    setModalState(null);
  }

  return { modalState, openFromCreditError, openAnalyticsPaywall, close };
}
