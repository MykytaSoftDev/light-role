"use client";

/**
 * TAILOR-7 — Loading screen.
 *
 * Full-bleed overlay covering the dashboard chrome. Reads `?job_id=` from
 * the URL, fires `tailorResumeForJob` on mount, and races the API promise
 * against simulated phase timers (5s + 10s = 15s minimum).
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §2.
 *
 * Note on the route filename: this is `page.tsx`, NOT a Next.js
 * `loading.tsx` Suspense fallback. Confusing naming inherited from the
 * spec's URL choice (`/dashboard/resumes/tailor/loading`).
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Circle, Lightbulb, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import StreakBackground from "@/components/streak-background";
import {
  TailorError,
  tailorResumeForJob,
  type TailoredResume,
} from "@/lib/tailored-resume-api";

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const PHASE_1_DURATION_MS = 5_000;
const PHASE_2_DURATION_MS = 10_000;
const MIN_TOTAL_MS = PHASE_1_DURATION_MS + PHASE_2_DURATION_MS; // 15s
const TIP_ROTATE_MS = 6_000;

const PHASES = [
  {
    label: "Extracting job offer details",
    activeSubtitle: "Reading the job description…",
  },
  {
    label: "Extracting keywords",
    activeSubtitle: "Identifying skills and tools…",
  },
  {
    label: "Tailoring resume",
    activeSubtitle: "Personalizing your resume…",
  },
];

const TIPS = [
  "Tailored resumes get up to 30% more responses than generic ones.",
  "Recruiters spend 7 seconds on a resume on average — keywords matter.",
  "Light Role keeps your profile as the source of truth — nothing is invented.",
  "You can re-tailor by editing your resume in the next step.",
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");

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

  // Holds the API outcome — neither phase progression nor redirect fires
  // until both this is set AND the simulated timeline is past phase 3 start.
  const apiResultRef = React.useRef<
    | { kind: "success"; resume: TailoredResume }
    | { kind: "error"; error: TailorError }
    | null
  >(null);

  // ---- Side effects -----------------------------------------------------

  // 1. Fire the API immediately on mount.
  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    (async () => {
      try {
        const resume = await tailorResumeForJob(jobId);
        if (!cancelled) {
          apiResultRef.current = { kind: "success", resume };
        }
      } catch (err) {
        if (cancelled) return;
        const error =
          err instanceof TailorError
            ? err
            : new TailorError(
                "UNKNOWN",
                err instanceof Error
                  ? err.message
                  : "Something went wrong. Please try again."
              );
        apiResultRef.current = { kind: "error", error };
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // 2. Simulated phase timeline. Once we hit the redirect gate, we either
  //    forward to the editor (success) or back to the wizard (error).
  React.useEffect(() => {
    if (!jobId) return;

    const startedAt = Date.now();
    let phaseTimer1: ReturnType<typeof setTimeout> | null = null;
    let phaseTimer2: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    // Phase 1 → Phase 2 at 5s.
    phaseTimer1 = setTimeout(() => {
      if (cancelled) return;
      setActivePhase(1);
    }, PHASE_1_DURATION_MS);

    // Phase 2 → Phase 3 at 15s.
    phaseTimer2 = setTimeout(() => {
      if (cancelled) return;
      setActivePhase(2);
    }, MIN_TOTAL_MS);

    // After the 15s minimum has elapsed, poll for the API result every 200ms.
    // (We could also use Promise.then + a "min elapsed" gate, but a poll keeps
    // the timeline & API outcome paths fully decoupled.)
    pollInterval = setInterval(() => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const result = apiResultRef.current;
      if (elapsed < MIN_TOTAL_MS || !result) return;

      // Both gates satisfied — clear timers and route.
      if (pollInterval) clearInterval(pollInterval);

      if (result.kind === "success") {
        router.replace(`/dashboard/resumes/${result.resume.id}`);
        return;
      }

      // Error path: flash phase 3 → failed for ~600ms before navigating.
      const error = result.error;
      setPhase3Failed(true);
      setTimeout(() => {
        if (cancelled) return;
        handleErrorRedirect(error, jobId, router);
      }, 600);
    }, 200);

    return () => {
      cancelled = true;
      if (phaseTimer1) clearTimeout(phaseTimer1);
      if (phaseTimer2) clearTimeout(phaseTimer2);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId, router]);

  // 3. Tip rotation every 6s.
  React.useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

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
        which is jarring during a 15s wait.
      */}
      <StreakBackground />

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-6 px-6">
        <div className="text-base font-semibold text-muted-foreground">
          Light Role
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
            aria-label="Tailoring progress"
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
          {phase3Failed
            ? "Something went wrong."
            : PHASES[activePhase]?.activeSubtitle}
        </p>

        <TipCard tip={TIPS[tipIndex]} />
      </div>
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
      ? "in progress"
      : state === "completed"
      ? "complete"
      : state === "failed"
      ? "failed"
      : "pending";

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
        Phase {index + 1} of {3}, {stateAria}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Tip card
// ---------------------------------------------------------------------------

function TipCard({ tip }: { tip: string }) {
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
          Did you know?
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
  router: ReturnType<typeof useRouter>
) {
  switch (error.code) {
    case "PROFILE_NOT_READY":
      toast.error("Your profile isn't complete enough to tailor a resume.");
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
      return;

    case "JOB_NOT_FOUND":
      toast.error("Job not found.");
      router.replace("/dashboard/resumes/tailor");
      return;

    case "RESUME_ALREADY_EXISTS": {
      const existingId = error.existingResumeId;
      if (existingId) {
        toast.message("A resume already exists for this job. Redirecting…");
        router.replace(`/dashboard/resumes/${existingId}`);
      } else {
        // Backend doesn't currently return `existing_resume_id` on 409 (see
        // tailored-resume-api.ts TODO). Fall back to the resumes list.
        toast.message(
          "A resume already exists for this job. Redirecting to your resumes."
        );
        router.replace("/dashboard/resumes");
      }
      return;
    }

    case "AI_UNAVAILABLE":
      toast.error("AI service is temporarily unavailable. Please try again.");
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
      return;

    default:
      toast.error(error.message || "Something went wrong. Please try again.");
      router.replace(`/dashboard/resumes/tailor?job_id=${jobId}`);
  }
}

