"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

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
// content is data-driven via the CONTENT table — adding a new credit error
// code is a one-line append.
// ---------------------------------------------------------------------------

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: CreditErrorCode;
  currentCount?: number;
  planLimit?: number;
  resetAt?: string;
}

interface BodyParams {
  planLimit?: number;
  resetAt?: string;
}

const CONTENT: Record<
  CreditErrorCode,
  { title: string; body: (p: BodyParams) => React.ReactNode }
> = {
  RESUME_CREDITS_EXCEEDED: {
    title: "Resume credits used up",
    body: ({ planLimit, resetAt }) =>
      `You've used all ${planLimit ?? 0} resume credits this cycle.${
        resetAt ? ` Resets on ${formatDate(resetAt)}.` : ""
      }`,
  },
  CL_CREDITS_EXCEEDED: {
    title: "Cover letter credits used up",
    body: ({ planLimit, resetAt }) =>
      `You've used all ${planLimit ?? 0} cover letter credits this cycle.${
        resetAt ? ` Resets on ${formatDate(resetAt)}.` : ""
      }`,
  },
  ACTIVE_JOBS_EXCEEDED: {
    title: "Active jobs limit reached",
    body: ({ planLimit }) =>
      `You've reached the limit of ${planLimit ?? 10} active jobs on Free plan. Delete a job or upgrade for unlimited tracking.`,
  },
  ANALYTICS_PAYWALL: {
    title: "Analytics is a Pro feature",
    body: () =>
      "Get access to detailed application analytics with Pro or Unlimited plan.",
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function UpgradeModal({
  open,
  onClose,
  reason,
  planLimit,
  resetAt,
}: UpgradeModalProps) {
  const router = useRouter();
  const { title, body } = CONTENT[reason];

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
          <DialogDescription>{body({ planLimit, resetAt })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={handleSeePlans}>
            See plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
