"use client";

/**
 * CL-6 — Loading overlay (full-bleed).
 *
 * Mirrors the resume-tailor loading screen visual pattern (see
 * `dashboard/resumes/tailor/loading/page.tsx`) but is rendered IN-LINE by
 * the wizard (no separate route — see spec §4.1). Reasons:
 *   - keeps the wizard's `variants` state alive after the API resolves
 *   - prevents `?step=loading` leaking into browser history
 *
 * Phase timeline:
 *   - Phase 1: 0..2.5s        — Analyzing the role
 *   - Phase 2: 2.5s..5.5s     — Reviewing your background
 *   - Phase 3: 5.5s..response — Crafting your cover letter
 *
 * The wizard parent owns the API mutation; this component only shows the
 * timeline, the rotating tip, and a credit-consumed hint at the bottom. On
 * `isError`, the active phase flashes failed for ~600ms and the parent
 * transitions back to the appropriate step.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Circle, Lightbulb, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import StreakBackground from "@/components/streak-background";

const PHASE_1_DURATION_MS = 2_500;
const PHASE_2_DURATION_MS = 3_000;
const TOTAL_MIN_MS = PHASE_1_DURATION_MS + PHASE_2_DURATION_MS; // 5.5s
const TIP_ROTATE_MS = 6_000;

type PhaseState = "pending" | "active" | "completed" | "failed";

interface WizardLoadingProps {
  /** Set true when the parent's mutation has errored — flashes phase 3 red. */
  isError: boolean;
}

export function WizardLoading({ isError }: WizardLoadingProps) {
  const t = useTranslations("coverLetters.wizard.loading");

  const phases = React.useMemo(
    () => [
      { label: t("phase1.label"), subtitle: t("phase1.subtitle") },
      { label: t("phase2.label"), subtitle: t("phase2.subtitle") },
      { label: t("phase3.label"), subtitle: t("phase3.subtitle") },
    ],
    [t],
  );

  const tips = React.useMemo(
    () => [t("tips.0"), t("tips.1"), t("tips.2"), t("tips.3")],
    [t],
  );

  const [activePhase, setActivePhase] = React.useState(0);
  const [tipIndex, setTipIndex] = React.useState(0);

  // Phase timeline: simulate Phase 1 → 2 at 2.5s, Phase 2 → 3 at 5.5s. Phase
  // 3 stays active until the parent transitions out of the loading step.
  React.useEffect(() => {
    const t1 = setTimeout(() => setActivePhase(1), PHASE_1_DURATION_MS);
    const t2 = setTimeout(() => setActivePhase(2), TOTAL_MIN_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Tip rotation.
  React.useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [tips.length]);

  function getPhaseState(idx: number): PhaseState {
    if (idx < activePhase) return "completed";
    if (idx === activePhase) {
      if (idx === 2 && isError) return "failed";
      return "active";
    }
    return "pending";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 overflow-hidden bg-background"
    >
      <StreakBackground />

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-6 px-6">
        <div className="text-base font-semibold text-muted-foreground">
          Light Role
        </div>

        {/* Glass card with phase list */}
        <div
          className={cn(
            "w-full max-w-md rounded-xl border border-border/60",
            "bg-card/70 backdrop-blur-md",
            "shadow-[0_8px_32px_-8px_oklch(60%_0.2_120/0.18)]",
            "dark:bg-card/60 dark:shadow-[0_8px_32px_-8px_oklch(88%_0.2_120/0.12)]",
          )}
        >
          <ul
            className="divide-y divide-border/60 p-2"
            aria-label="Cover letter generation progress"
          >
            {phases.map((p, idx) => (
              <PhaseRow
                key={idx}
                index={idx}
                label={p.label}
                state={getPhaseState(idx)}
              />
            ))}
          </ul>
        </div>

        {/* Active subtitle */}
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {isError && activePhase === 2 ? t("failed") : phases[activePhase]?.subtitle}
        </p>

        {/* Rotating tip card — hidden on short viewports */}
        <div className="hidden w-full max-w-md min-[640px]:block">
          <div
            className={cn(
              "rounded-lg border border-border/60 p-4 text-sm",
              "bg-card/70 backdrop-blur-md",
              "shadow-[0_4px_16px_-6px_oklch(60%_0.2_120/0.12)]",
              "dark:bg-card/60",
            )}
          >
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("tipHeading")}
            </div>
            <p
              key={tipIndex}
              className="text-muted-foreground transition-opacity duration-200"
            >
              {tips[tipIndex]}
            </p>
          </div>
        </div>

        {/* Credit-consumed hint — critical UX honesty (PRD §3.5.5) */}
        <p className="max-w-md text-center text-xs text-muted-foreground">
          {t("creditHint")}
        </p>
      </div>
    </div>
  );
}

interface PhaseRowProps {
  index: number;
  label: string;
  state: PhaseState;
}

function PhaseRow({ index, label, state }: PhaseRowProps) {
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
        state === "active" && "rounded-md bg-muted/40",
      )}
    >
      <Icon className={iconClass} aria-hidden="true" />
      <span className={labelClass}>{label}</span>
      <span className="sr-only">
        Phase {index + 1} of 3, {stateAria}
      </span>
    </li>
  );
}
