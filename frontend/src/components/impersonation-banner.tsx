"use client";

import { Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { useStopImpersonation } from "@/hooks/api/useAdmin";
import { useUser } from "@/hooks/api/useUser";

// ── Storage keys ───────────────────────────────────────────────────────────
// Both keys are written by the Impersonate button on the admin user-detail
// page (see admin-user-profile-card). The banner reads them to:
//   - drive the T-5min warning + auto-exit countdown (started_at)
//   - send the admin back to the user-detail page on exit (target_id)
const SS_TARGET_KEY = "impersonation_target_id";
const SS_STARTED_KEY = "impersonation_started_at";

// SPEC §6.3 — impersonation JWT expires after 60 minutes (no refresh path).
const IMPERSONATION_TTL_SECONDS = 60 * 60;
const WARN_AT_SECONDS = 5 * 60;

/**
 * Returns where to send the admin after a successful impersonation stop.
 * Prefers the sessionStorage-stored target_id (so the admin lands back on the
 * user they were viewing); falls back to the users list if the storage entry
 * is missing (e.g. the tab was closed and reopened mid-session).
 */
function resolveReturnUrl(): string {
  if (typeof window === "undefined") return DASHBOARD_PAGES.ADMIN_USERS;
  const id = window.sessionStorage.getItem(SS_TARGET_KEY);
  return id ? DASHBOARD_PAGES.ADMIN_USER(id) : DASHBOARD_PAGES.ADMIN_USERS;
}

/**
 * Sticky red banner shown on every dashboard page while an admin is
 * impersonating another user (SPEC §5.7 + §6.9). Renders `null` for normal
 * sessions so the `useUser` query is the single source of truth.
 *
 * Token expiry handling: the impersonation JWT cookie is httpOnly so we
 * cannot read `exp` directly. Instead we trust a sessionStorage timestamp
 * stamped at impersonation start. Edge case (e.g. fresh tab during an
 * active session): we default the countdown to a full 60 min — degraded
 * UX, not broken.
 */
export function ImpersonationBanner() {
  const { data: user } = useUser();
  const stop = useStopImpersonation();

  // Live countdown to expiry, in seconds. Initialised to the full TTL so
  // the first paint never shows the "Expires in …" inline text spuriously.
  const [timeRemaining, setTimeRemaining] = useState<number>(
    IMPERSONATION_TTL_SECONDS
  );

  // Single-fire guard for the T-5min toast — without this the toast would
  // re-trigger every tick after it crosses the threshold.
  const warnedRef = useRef<boolean>(false);

  // One-shot guard for the auto-exit when the timer reaches zero. The stop
  // endpoint will likely 401 because the cookie is gone, but a full reload
  // is what the SPEC asks for either way.
  const autoExitedRef = useRef<boolean>(false);

  const isImpersonating = user?.is_impersonating === true;

  // Tick the countdown every second whenever the banner is active. The
  // interval is created/torn down with the banner's mount lifetime so it
  // stops the moment `useUser()` reflects a non-impersonation session.
  useEffect(() => {
    if (!isImpersonating) return;

    const startedAtRaw =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(SS_STARTED_KEY)
        : null;
    const startedAt =
      startedAtRaw && Number.isFinite(Number(startedAtRaw))
        ? Number(startedAtRaw)
        : Date.now();

    const update = () => {
      const elapsedMs = Date.now() - startedAt;
      const remaining = Math.floor(
        (IMPERSONATION_TTL_SECONDS * 1000 - elapsedMs) / 1000
      );
      setTimeRemaining(remaining);

      if (
        remaining <= WARN_AT_SECONDS &&
        remaining > 0 &&
        !warnedRef.current
      ) {
        warnedRef.current = true;
        toast.warning("Impersonation expires in 5 minutes. Please wrap up.");
      }

      if (remaining <= 0 && !autoExitedRef.current) {
        autoExitedRef.current = true;
        // Fire-and-forget the stop endpoint; cookie is dead anyway, the
        // redirect is what matters. `void` keeps the linter happy.
        void stop.mutateAsync().catch(() => {
          // Token already invalid — ignore and reload below.
        });
        window.location.href = DASHBOARD_PAGES.ADMIN_USERS;
      }
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
    // `stop` is a fresh object literal each render (see memory
    // feedback_unstable_hook_refs); intentionally omitted from deps — the
    // effect only re-runs when impersonation status flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating]);

  if (!isImpersonating || !user) return null;

  const handleExit = async () => {
    try {
      await stop.mutateAsync();
      const returnUrl = resolveReturnUrl();
      // Clear our session bookkeeping before reloading — the next page render
      // is for the admin, not the impersonated user.
      window.sessionStorage.removeItem(SS_TARGET_KEY);
      window.sessionStorage.removeItem(SS_STARTED_KEY);
      // Full reload to rebuild TanStack Query cache for the admin identity.
      window.location.href = returnUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to exit impersonation"
      );
    }
  };

  const showCountdown = timeRemaining < WARN_AT_SECONDS;
  const minutes = Math.max(0, Math.floor(timeRemaining / 60));
  const seconds = Math.max(0, timeRemaining % 60);

  return (
    <div className="sticky top-0 z-50 flex h-10 w-full items-center justify-between gap-3 bg-destructive px-4 text-destructive-foreground shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Unlock className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Viewing as <strong>{user.email}</strong> — admin:{" "}
          <strong>{user.impersonator_email ?? "unknown"}</strong>
        </span>
        {showCountdown && (
          <span className="text-xs opacity-80">
            Expires in {minutes}m {seconds}s
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-destructive-foreground hover:bg-destructive-foreground/10"
        onClick={handleExit}
        disabled={stop.isPending}
      >
        {stop.isPending ? "Exiting…" : "Exit impersonation"}
      </Button>
    </div>
  );
}
