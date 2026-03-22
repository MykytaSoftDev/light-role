"use client";

import { useState } from "react";

export type UpgradeReason = "ai_limit" | "jobs_limit";

export interface UpgradeModalState {
  open: boolean;
  reason: UpgradeReason;
  currentUsage?: number;
  limit?: number;
  resetDate?: string;
}

export function useUpgradeModal() {
  const [modalState, setModalState] = useState<UpgradeModalState | null>(null);

  function openAiLimitModal(currentUsage: number, limit: number, resetDate: string) {
    setModalState({ open: true, reason: "ai_limit", currentUsage, limit, resetDate });
  }

  function openJobsLimitModal(currentUsage?: number, limit?: number) {
    setModalState({ open: true, reason: "jobs_limit", currentUsage, limit });
  }

  function close() {
    setModalState(null);
  }

  return { modalState, openAiLimitModal, openJobsLimitModal, close };
}
