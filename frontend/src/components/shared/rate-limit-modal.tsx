"use client";

import { Clock } from "lucide-react";
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

// ---------------------------------------------------------------------------
// MONETIZE-15 — anti-abuse rate-limit modal per PRD §12.6.
//
// Triggered by HTTP 429 with `error_code: "AI_RATE_LIMIT"`. Distinct from
// `UpgradeModal` because upgrading does NOT lift this limit — it is a
// short-lived (typically 1h) anti-abuse cap. Single "Got it" CTA, no upgrade
// button.
// ---------------------------------------------------------------------------

export interface RateLimitModalProps {
  open: boolean;
  onClose: () => void;
  /** ISO timestamp from the 429 envelope. */
  retryAt?: string;
}

function secondsUntil(iso: string): number | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.round((d.getTime() - Date.now()) / 1000));
  } catch {
    return null;
  }
}

export function RateLimitModal({ open, onClose, retryAt }: RateLimitModalProps) {
  const seconds = retryAt ? secondsUntil(retryAt) : null;
  const tModal = useTranslations("Errors.rateLimitModal");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <DialogTitle>{tModal("title")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1">
              <p>{tModal("body1")}</p>
              {seconds != null && (
                <p>{tModal("body2WithTime", { seconds })}</p>
              )}
              <p>{tModal("supportLine")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            {tModal("gotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
