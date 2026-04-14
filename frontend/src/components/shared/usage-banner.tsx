"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageBannerProps {
  aiUsed: number;
  aiLimit: number;
}

// ---------------------------------------------------------------------------
// Session storage key
// ---------------------------------------------------------------------------

const DISMISSED_KEY = "usage_banner_dismissed";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageBanner({ aiUsed, aiLimit }: UsageBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  // Read sessionStorage on mount (client-only)
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  const ratio = aiLimit > 0 ? aiUsed / aiLimit : 0;

  // Only render when usage >= 80%
  if (ratio < 0.8 || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  const isAtLimit = aiUsed >= aiLimit;

  return (
    <Alert className="flex items-center justify-between gap-3 border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex min-w-0 items-center gap-2.5">
        <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
          {isAtLimit ? (
            <>
              You&apos;ve used all <strong>{aiLimit}</strong> AI operations this month.{" "}
              <Link
                href={DASHBOARD_PAGES.UPGRADE}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Upgrade to get 150 operations.
              </Link>
            </>
          ) : (
            <>
              You&apos;ve used <strong>{aiUsed}</strong> of <strong>{aiLimit}</strong> AI operations
              this month.{" "}
              <Link
                href={DASHBOARD_PAGES.UPGRADE}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Upgrade to get 150 operations.
              </Link>
            </>
          )}
        </AlertDescription>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
