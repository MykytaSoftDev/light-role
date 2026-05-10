"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import type { CreditErrorCode } from "@/lib/api-errors";

// ---------------------------------------------------------------------------
// MONETIZE-14 — minimal upgrade modal per PRD 12.16.
//
// Pricing UI lives on /dashboard/upgrade (MONETIZE-10). This dialog is
// intentionally a single CTA: title + body + "See plans" button. Reason-aware
// content is driven by the Errors.upgradeModal.* namespace.
// ---------------------------------------------------------------------------

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: CreditErrorCode;
  currentCount?: number;
  planLimit?: number;
  resetAt?: string;
}

export function UpgradeModal({
  open,
  onClose,
  reason,
  planLimit,
  resetAt,
}: UpgradeModalProps) {
  const router = useRouter();
  const tCommon = useTranslations("Common.actions");
  const tModal = useTranslations("Errors.upgradeModal");

  void planLimit;
  void resetAt;

  let title: string;
  let body: string;
  switch (reason) {
    case "RESUME_CREDITS_EXCEEDED":
      title = tModal("resumeCreditsTitle");
      body = tModal("resumeCreditsBody");
      break;
    case "CL_CREDITS_EXCEEDED":
      title = tModal("clCreditsTitle");
      body = tModal("clCreditsBody");
      break;
    case "ACTIVE_JOBS_EXCEEDED":
      title = tModal("activeJobsTitle");
      body = tModal("activeJobsBody");
      break;
    case "ANALYTICS_PAYWALL":
      title = tModal("analyticsTitle");
      body = tModal("analyticsBody");
      break;
    default:
      title = tModal("title");
      body = tModal("description");
  }

  function handleSeePlans() {
    onClose();
    router.push(DASHBOARD_PAGES.UPGRADE);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("close")}
          </Button>
          <Button type="button" onClick={handleSeePlans}>
            {tModal("seePlans")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
