"use client";

/**
 * TAILOR-7 — Loading screen.
 *
 * Full-bleed overlay covering the dashboard chrome. Reads `?job_id=` from
 * the URL, fires `tailorResumeForJob` on mount, and dispatches success /
 * error UX as soon as the API resolves. Phase timers (5s + 10s) advance
 * the visual indicator while in flight but don't gate dispatch.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §2.
 *
 * Note on the route filename: this is `page.tsx`, NOT a Next.js
 * `loading.tsx` Suspense fallback. Confusing naming inherited from the
 * spec's URL choice (`/dashboard/resumes/tailor/loading`).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Circle, Lightbulb, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import StreakBackground from "@/components/streak-background";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { RateLimitModal } from "@/components/shared/rate-limit-modal";
import { useRateLimitModal } from "@/hooks/use-rate-limit-modal";
import { TailorError, tailorResumeForJob } from "@/lib/tailored-resume-api";

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const PHASE_1_DURATION_MS = 5_000;
const PHASE_2_DURATION_MS = 10_000;
const TIP_ROTATE_MS = 6_000;

// Phases / tips are loaded inside the component via next-intl `t()` and
// `t.raw()` (for the `tips` array — see Resumes.tailor.loading.tips in en.json).
type PhaseState = "pending" | "active" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TailorLoadingPage() {
  // `useSearchParams` requires a Suspense boundary in Next.js 15 (see
  // verify-email/page.tsx for the same pattern).
  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <TailorLoadingContent />
    </React.Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <StreakBackground />
      <div className="relative z-10 flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  );
}

function TailorLoadingContent() {
  const t = useTranslations("Resumes.tailor.loading");
  const tToast = useTranslations("Resumes.tailor.toast");
  const tApp = useTranslations("app");
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams?.get("job_id") ?? null;

  // Phase definitions sourced from Resumes.tailor.loading.* keys.
  const PHASES = React.useMemo(
    () => [
      { label: t("phase1"), activeSubtitle: t("phase1Sub") },
      { label: t("phase2"), activeSubtitle: t("phase2Sub") },
      { label: t("phase3"), activeSubtitle: t("phase3Sub") },
    ],
    [t]
  );

  // `tips` is an array in the dictionary — `t.raw` returns it untyped.
  const TIPS = React.useMemo<string[]>(
    () => (t.raw("tips") as string[]) ?? [],
    [t]
  );

  // MONETIZE-14/15 — render UpgradeModal / RateLimitModal on this overlay
  // when the tailor POST returns 402 / 429. Closing the modal navigates
  // back to the wizard with the original `?job_id=…`.
  const upgrade = useUpgradeModal();
  const rateLimit = useRateLimitModal();

  // Stash modal hooks in refs so the polling effect below can read live
  // values without re-running on every render. The hooks return a fresh
  // object literal each render, so depending on them directly resets
  // `startedAt` every time the tip-rotation interval re-renders, and the
  // 15s `MIN_TOTAL_MS` gate never trips. See bug: 402 → infinite spinner.
  const upgradeRef = React.useRef(upgrade);
  upgradeRef.current = upgrade;
  const rateLimitRef = React.useRef(rateLimit);
  rateLimitRef.current = rateLimit;
  const routerRef = React.useRef(router);
  routerRef.current = router;

  // No job_id → bounce back to wizard.
  React.useEffect(() => {
    if (!jobId) {
      router.replace("/dashboard/resumes/tailor");
    }
  }, [jobId, router]);

  // Phase index 0..2 driven by simulated timers; transitions to "failed" on error.
  const [activePhase, setActivePhase] = React.useState<number>(0);
  const [phase3Failed, setPhase3Failed] = React.useState(false);
  const [tipIndex, setTipIndex] = React.useState(0);

  // ---- Side effects -----------------------------------------------------

  // 1. Fire the API immediately on mount and dispatch as soon as it resolves.
  //    The phase timers below are purely visual — we no longer gate the
  //    success/error dispatch on a 15s minimum. A typical tailor call resolves
  //    in 1-10s; making the user wait longer for the same result felt sluggish.
  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    (async () => {
      try {
        const resume = await tailorResumeForJob(jobId);
        if (cancelled) return;
        routerRef.current.replace(`/dashboard/resumes/${resume.id}`);
      } catch (err) {
        if (cancelled) return;
        const error =
          err instanceof TailorError
            ? err
            : new TailorError(
                "UNKNOWN",
                err instanceof Error
                  ? err.message
                  : tToast("networkFail")
              );

        // MONETIZE-14 / MONETIZE-15 — credit + rate-limit errors stay on the
        // overlay (no redirect) so the modal can render with full context.
        // Closing the modal is what navigates the user back to the wizard.
        // Set the "failed" visual synchronously with opening the modal — no
        // 600ms flash since the user stays on this screen anyway.
        if (error.code === "OUT_OF_QUOTA" && error.creditError) {
          setPhase3Failed(true);
          upgradeRef.current.openFromCreditError(error.creditError);
          return;
        }
        if (error.code === "RATE_LIMITED" && error.rateLimitError) {
          setPhase3Failed(true);
          rateLimitRef.current.openFromRateLimitError(error.rateLimitError);
          return;
        }

        // All other errors: flash phase 3 → failed for ~600ms before navigating
        // away, so the user sees a beat of "failed" indication before the route.
        setPhase3Failed(true);
        setTimeout(() => {
          if (cancelled) return;
          handleErrorRedirect(error, jobId, routerRef.current, tToast);
        }, 600);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // 2. Visual phase timeline. Pure cosmetics — these timers just advance the
  //    "active phase" indicator while the API is in flight. If the API
  //    resolves before they fire, the page navigates away and the timers
  //    are cleaned up on unmount.
  React.useEffect(() => {
    if (!jobId) return;

    // Phase 1 → Phase 2 at 5s.
    const phaseTimer1 = setTimeout(() => {
      setActivePhase(1);
    }, PHASE_1_DURATION_MS);

    // Phase 2 → Phase 3 at 15s.
    const phaseTimer2 = setTimeout(() => {
      setActivePhase(2);
    }, PHASE_1_DURATION_MS + PHASE_2_DURATION_MS);

    return () => {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
    };
  }, [jobId]);

  // 3. Tip rotation every 6s.
  React.useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [TIPS.length]);

  // ---- Render -----------------------------------------------------------

  // Phase visual state mapping.
  const getPhaseState = (idx: number): PhaseState => {
    if (idx < activePhase) return "completed";
    if (idx === activePhase) {
      if (idx === 2 && phase3Failed) return "failed";
      return "active";
    }
    return "pending";
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 overflow-hidden bg-background"
    >
      {/*
        Ambient backdrop — same animated streaks used on auth pages. Without
        a backdrop the screen reads as empty (especially on light theme),
        which is jarring while the API is in flight.
      */}
      <StreakBackground />

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-6 px-6">
        <div className="text-base font-semibold text-muted-foreground">
          {tApp("name")}
        </div>

        {/*
          Glass card hosting the phase list. Backdrop-blur lets the streaks
          show through softly while keeping the rows readable. Subtle
          primary-tinted shadow nudges the eye toward "something is happening".
        */}
        <div
          className={cn(
            "w-full max-w-md rounded-xl border border-border/60",
            "bg-card/70 backdrop-blur-md",
            "shadow-[0_8px_32px_-8px_oklch(60%_0.2_120/0.18)]",
            "dark:bg-card/60 dark:shadow-[0_8px_32px_-8px_oklch(88%_0.2_120/0.12)]"
          )}
        >
          <ul
            className="divide-y divide-border/60 p-2"
            aria-label={t("progressAria")}
          >
            {PHASES.map((p, idx) => {
              const state = getPhaseState(idx);
              return <PhaseRow key={idx} index={idx} phase={p} state={state} />;
            })}
          </ul>
        </div>

        {/* Active subtitle */}
        <p
          className="text-sm text-muted-foreground text-center"
          aria-live="polite"
        >
          {phase3Failed ? t("failed") : PHASES[activePhase]?.activeSubtitle}
        </p>

        <TipCard tip={TIPS[tipIndex]} heading={t("tipHeading")} />
      </div>

      {/*
        MONETIZE-14 / MONETIZE-15 — limit-error modals rendered on the
        overlay itself. We don't redirect mid-error so the modal can show
        full context; closing the modal navigates back to the wizard.

        The fallback `reason` / `open=false` props are just type-satisfiers
        when `modalState` is null — the dialog won't render in that case.
      */}
      <UpgradeModal
        open={upgrade.modalState?.open ?? false}
        onClose={() => {
          upgrade.close();
          if (jobId) {
            router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
          } else {
            router.replace("/dashboard/resumes/tailor");
          }
        }}
        reason={upgrade.modalState?.reason ?? "RESUME_CREDITS_EXCEEDED"}
        currentCount={upgrade.modalState?.currentCount}
        planLimit={upgrade.modalState?.planLimit}
        resetAt={upgrade.modalState?.resetAt}
      />
      <RateLimitModal
        open={rateLimit.modalState?.open ?? false}
        onClose={() => {
          rateLimit.close();
          if (jobId) {
            router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
          } else {
            router.replace("/dashboard/resumes/tailor");
          }
        }}
        retryAt={rateLimit.modalState?.retryAt}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase row
// ---------------------------------------------------------------------------

interface PhaseRowProps {
  index: number;
  phase: { label: string };
  state: PhaseState;
}

function PhaseRow({ index, phase, state }: PhaseRowProps) {
  const t = useTranslations("Resumes.tailor.loading");
  const Icon =
    state === "completed"
      ? Check
      : state === "active"
      ? Loader2
      : state === "failed"
      ? X
      : Circle;

  const iconClass = cn("h-5 w-5 shrink-0", {
    "text-muted-foreground": state === "pending",
    "text-primary motion-safe:animate-spin": state === "active",
    "text-green-600 dark:text-green-500": state === "completed",
    "text-destructive": state === "failed",
  });

  const labelClass = cn("text-sm", {
    "text-muted-foreground": state === "pending" || state === "completed",
    "font-medium text-foreground": state === "active",
    "font-medium text-destructive": state === "failed",
  });

  const stateAria =
    state === "active"
      ? t("phaseState.active")
      : state === "completed"
      ? t("phaseState.completed")
      : state === "failed"
      ? t("phaseState.failed")
      : t("phaseState.pending");

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-3",
        state === "active" && "bg-muted/40 rounded-md"
      )}
    >
      <Icon className={iconClass} aria-hidden="true" />
      <span className={labelClass}>{phase.label}</span>
      <span className="sr-only">
        {t("phaseAria", { step: index + 1, total: 3, label: stateAria })}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Tip card
// ---------------------------------------------------------------------------

function TipCard({ tip, heading }: { tip: string; heading: string }) {
  return (
    <div className="hidden min-[640px]:block w-full max-w-md">
      <div
        className={cn(
          "rounded-lg border border-border/60 p-4 text-sm",
          "bg-card/70 backdrop-blur-md",
          "shadow-[0_4px_16px_-6px_oklch(60%_0.2_120/0.12)]",
          "dark:bg-card/60"
        )}
      >
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
          {heading}
        </div>
        <p
          key={tip}
          className="text-muted-foreground transition-opacity duration-200"
        >
          {tip}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error mapping & redirects
// ---------------------------------------------------------------------------

function handleErrorRedirect(
  error: TailorError,
  jobId: string,
  router: ReturnType<typeof useRouter>,
  // The translator from useTranslations("Resumes.tailor.toast"). Typed loosely
  // because TFunctions are namespace-specific and awkward to import as a type.
  tToast: ReturnType<typeof useTranslations>
) {
  switch (error.code) {
    case "PROFILE_NOT_READY":
      toast.error(tToast("profileNotReady"));
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
      return;

    case "JOB_NOT_FOUND":
      toast.error(tToast("jobNotFound"));
      router.replace("/dashboard/resumes/tailor");
      return;

    case "RESUME_ALREADY_EXISTS": {
      const existingId = error.existingResumeId;
      if (existingId) {
        toast.message(tToast("alreadyExists"));
        router.replace(`/dashboard/resumes/${existingId}`);
      } else {
        // Backend doesn't currently return `existing_resume_id` on 409 (see
        // tailored-resume-api.ts TODO). Fall back to the resumes list.
        toast.message(tToast("alreadyExists"));
        router.replace("/dashboard/resumes");
      }
      return;
    }

    case "AI_UNAVAILABLE":
      toast.error(tToast("aiFail"));
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
      return;

    default:
      toast.error(error.message || tToast("networkFail"));
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
  }
}

