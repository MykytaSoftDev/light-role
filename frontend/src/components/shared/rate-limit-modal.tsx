"use client";

import { Clock } from "lucide-react";

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
// button. Visual conventions match `UpgradeModal` (icon-circle, sm:max-w-md)
// but the icon-circle uses orange to differentiate the situation from
// upgrade prompts.
// ---------------------------------------------------------------------------

export interface RateLimitModalProps {
  open: boolean;
  onClose: () => void;
  /** ISO timestamp from the 429 envelope; rendered as HH:MM in 24h format. */
  retryAt?: string;
}

function formatTime(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

export function RateLimitModal({ open, onClose, retryAt }: RateLimitModalProps) {
  const time = retryAt ? formatTime(retryAt) : null;

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
          <DialogTitle>Generation temporarily limited</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1">
              <p>
                We&apos;ve detected unusually high activity on your account. To
                ensure fair use for all users, AI generations are paused for
                the next hour.
              </p>
              {time && (
                <p>
                  You can resume generating at{" "}
                  <span className="font-medium text-foreground">{time}</span>.
                </p>
              )}
              <p>
                If this seems wrong, contact{" "}
                <a
                  href="mailto:support@lightrole.com"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  support@lightrole.com
                </a>
                .
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
