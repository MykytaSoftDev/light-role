"use client";

/**
 * CL-4..CL-7 — Wizard root.
 *
 * Single client component that owns the wizard state machine (Step 1 →
 * Step 2 → Loading → Step 3) and the two mutations:
 *   - CL-2: POST /api/v1/jobs/{job_id}/cover-letter (generate variants)
 *   - CL-3: POST /api/v1/cover-letters (finalize chosen variant)
 *
 * State lives in-memory only — no `?step=` URL param. Spec §1.2.
 *
 * Materialises `source_snapshot` client-side from the TR or Profile loaded in
 * Step 1 (PRD 6.6 / spec §5.5). The backend trusts whatever we send and
 * never re-fetches.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { RateLimitModal } from "@/components/shared/rate-limit-modal";
import { useRateLimitModal } from "@/hooks/use-rate-limit-modal";

import { useProfile } from "@/hooks/api/useProfile";
import { queryKeys } from "@/hooks/api/keys";
import { listJobs, type JobOption } from "@/lib/jobs-api";
import {
  listCoverLetters,
  generateCoverLetterVariants,
  finalizeCoverLetter,
  CoverLetterError,
  type CoverLetterSourceType,
  type CoverLetterVariantContent,
} from "@/lib/cover-letter-api";
import { getTailoredResumeForJob } from "@/lib/tailored-resume-api";
import type { CLLength, CLStyle, CLTone, CoverLetterListItem } from "@/types/cover-letter";

import { Step1JobSource } from "./step-1-job-source";
import { Step2Settings } from "./step-2-settings";
import { Step3Variants } from "./step-3-variants";
import { WizardLoading } from "./wizard-loading";
import { MissingProfileDialog } from "./missing-profile-dialog";
import { ExistingCoverLetterDialog } from "./existing-cover-letter-dialog";

// ---------------------------------------------------------------------------
// State machine types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | "loading" | 3;

interface WizardState {
  step: WizardStep;
  jobId: string;
  sourceType: CoverLetterSourceType | null;
  additionalContext: string;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  variants: CoverLetterVariantContent[];
  selectedVariantIdx: number | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  jobId: "",
  sourceType: null,
  additionalContext: "",
  style: "job_matched",
  tone: "confident",
  length: "medium",
  variants: [],
  selectedVariantIdx: null,
};

// ---------------------------------------------------------------------------
// Profile-readiness rule (mirrors `_profile_data_for_cl` in jobs.py).
// ---------------------------------------------------------------------------

function isProfileReadyForCoverLetter(
  data: ReturnType<typeof useProfile>["data"],
): boolean {
  if (!data?.profile_data) return false;
  const employment = data.profile_data.employment ?? [];
  const projects = data.profile_data.projects ?? [];
  return employment.length > 0 || projects.length > 0;
}

// ---------------------------------------------------------------------------
// Eligible-jobs query — joins `listJobs` and `listCoverLetters` to filter out
// jobs that already have a CL (spec §2.3.1 — backend has no `has_cover_letter`
// filter today).
// ---------------------------------------------------------------------------

interface EligibleJobsResult {
  /** Jobs without an existing CL — populates the dropdown. */
  eligibleJobs: JobOption[];
  /** Map from job_id → CL summary (for the "already exists" dialog). */
  coverLettersByJobId: Map<string, CoverLetterListItem>;
}

async function fetchEligibleJobs(): Promise<EligibleJobsResult> {
  const [jobsRes, clRes] = await Promise.all([listJobs(), listCoverLetters()]);
  const coverLettersByJobId = new Map<string, CoverLetterListItem>();
  for (const cl of clRes.items) {
    if (cl.job_id) coverLettersByJobId.set(cl.job_id, cl);
  }
  const eligibleJobs = jobsRes.items.filter((j) => !coverLettersByJobId.has(j.id));
  return { eligibleJobs, coverLettersByJobId };
}

// ---------------------------------------------------------------------------
// Step indicator (visible on Steps 1/2/3 — hidden during Loading).
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("coverLetters.wizard.indicator");
  const labels = [t("step1"), t("step2"), t("step3")];
  return (
    <div className="flex items-center justify-center" aria-label="Wizard progress">
      {[1, 2, 3].map((stepNum, i) => {
        const completed = stepNum < current;
        const active = stepNum === current;
        return (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  completed && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !completed && !active && "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-medium whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {labels[i]}
              </span>
              <span className="sr-only">
                Step {stepNum} of 3, {labels[i]}
                {active ? ", current" : ""}
              </span>
            </div>
            {i < 2 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-2 mb-4 h-px w-12 sm:w-16 transition-colors",
                  stepNum < current ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard component
// ---------------------------------------------------------------------------

interface CoverLetterWizardProps {
  initialJobId: string | null;
}

export function CoverLetterWizard({ initialJobId }: CoverLetterWizardProps) {
  const t = useTranslations("coverLetters.wizard");
  const router = useRouter();
  const queryClient = useQueryClient();

  // ---- Wizard state ------------------------------------------------------
  const [state, setState] = React.useState<WizardState>({
    ...INITIAL_STATE,
    jobId: initialJobId ?? "",
  });

  // ---- Source snapshot — materialised from TR or Profile in Step 1 -------
  // Stored here (not in `state`) because it is reference-stable JSONB and
  // doesn't drive any visual re-renders; only the finalize call reads it.
  const sourceSnapshotRef = React.useRef<Record<string, unknown> | null>(null);

  // ---- Modals ------------------------------------------------------------
  const [missingProfileOpen, setMissingProfileOpen] = React.useState(false);
  const [existingClOpen, setExistingClOpen] = React.useState(false);
  const [existingClInfo, setExistingClInfo] = React.useState<{
    coverLetterId: string;
    jobTitle: string;
    company: string | null;
    createdAt: string;
  } | null>(null);

  const upgrade = useUpgradeModal();
  const rateLimit = useRateLimitModal();

  // ---- Queries -----------------------------------------------------------
  const profile = useProfile();
  const profileReady = isProfileReadyForCoverLetter(profile.data);

  const eligibleJobs = useQuery({
    queryKey: queryKeys.coverLetters.eligibleJobs(),
    queryFn: fetchEligibleJobs,
    staleTime: 1000 * 60 * 2,
  });

  // Per-job tailored-resume detection (Step 1 source dropdown branching).
  const trCheck = useQuery({
    queryKey: state.jobId
      ? queryKeys.jobs.tailoredResumeCheck(state.jobId)
      : ["jobs", "noop"],
    queryFn: () => getTailoredResumeForJob(state.jobId),
    enabled: !!state.jobId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // ---- Profile-not-ready gate on mount -----------------------------------
  React.useEffect(() => {
    if (profile.isLoading) return;
    if (!profileReady) {
      setMissingProfileOpen(true);
    }
  }, [profile.isLoading, profileReady]);

  // ---- ?job_id pre-fill conflict detection -------------------------------
  // If the pre-filled job_id already has a CL, surface the "already exists"
  // dialog. Re-runs whenever the eligible-jobs cache settles.
  React.useEffect(() => {
    if (!initialJobId) return;
    if (eligibleJobs.isLoading || !eligibleJobs.data) return;

    const conflict = eligibleJobs.data.coverLettersByJobId.get(initialJobId);
    if (conflict) {
      // The conflicting job is filtered OUT of `eligibleJobs`, so we surface
      // the CL's `name` (which the wizard auto-generated as
      // `{company} — {title}` at finalize time) as the dialog heading.
      setExistingClInfo({
        coverLetterId: conflict.id,
        jobTitle: conflict.name,
        company: null,
        createdAt: conflict.created_at,
      });
      setExistingClOpen(true);
      // Clear the pre-fill so the dropdown stays empty.
      setState((s) => ({ ...s, jobId: "" }));
    }
    // The non-conflict case (job IS in eligibleJobs) needs no action — the
    // dropdown will show the pre-selected jobId once it renders.
  }, [
    initialJobId,
    eligibleJobs.isLoading,
    eligibleJobs.data,
  ]);

  // ---- Mutations ---------------------------------------------------------
  const generateMut = useMutation({
    mutationFn: async () => {
      // Materialise source_snapshot here so the finalize step has it ready.
      // For TR: use `tailored_data` (the AI-tailored snapshot).
      // For Profile: use the current `profile_data`.
      let snapshot: Record<string, unknown> = {};
      if (state.sourceType === "tailored_resume" && trCheck.data) {
        snapshot = (trCheck.data.tailored_data ?? {}) as unknown as Record<
          string,
          unknown
        >;
      } else if (state.sourceType === "profile" && profile.data) {
        snapshot = (profile.data.profile_data ?? {}) as unknown as Record<
          string,
          unknown
        >;
      }
      sourceSnapshotRef.current = snapshot;

      return generateCoverLetterVariants(state.jobId, {
        source_type: state.sourceType!,
        style: state.style,
        tone: state.tone,
        length: state.length,
        additional_context: state.additionalContext.trim() || null,
      });
    },
    onSuccess: () => {
      // Invalidate usage so the dashboard reflects the consumed credit.
      queryClient.invalidateQueries({ queryKey: queryKeys.user.usage });
    },
  });

  const finalizeMut = useMutation({
    mutationFn: () => {
      const idx = state.selectedVariantIdx;
      if (idx === null) {
        throw new Error("No variant selected.");
      }
      const variant = state.variants[idx];
      const job = eligibleJobs.data?.eligibleJobs.find(
        (j) => j.id === state.jobId,
      );
      const name =
        job?.company && job.company.trim().length > 0
          ? `${job.company} — ${job.title}`
          : job?.title || "Cover Letter";

      return finalizeCoverLetter({
        job_id: state.jobId,
        name,
        content: variant.content,
        source_type: state.sourceType!,
        source_snapshot: sourceSnapshotRef.current ?? {},
        style: state.style,
        tone: state.tone,
        length: state.length,
        additional_context: state.additionalContext.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coverLetters.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.coverLetters.eligibleJobs() });
    },
  });

  // ---- Handlers ----------------------------------------------------------

  const handleGenerate = React.useCallback(async () => {
    if (!state.jobId || !state.sourceType) return;
    setState((s) => ({ ...s, step: "loading" }));
    generateMut.reset();
    try {
      const result = await generateMut.mutateAsync();
      setState((s) => ({
        ...s,
        step: 3,
        variants: result.variants,
        selectedVariantIdx: null,
      }));
    } catch (err) {
      // Loading screen handles the per-error UX. Show failure flash for ~600ms,
      // then return to Step 2 (or Step 1 / dialog as appropriate).
      const cle =
        err instanceof CoverLetterError
          ? err
          : new CoverLetterError("UNKNOWN", t("loading.networkFailToast"));

      // Brief 600ms failure flash on the loading screen — handled by the
      // loading component reading the mutation's `isError` state. Wait, then
      // dispatch the error UX.
      setTimeout(() => {
        switch (cle.code) {
          case "PROFILE_NOT_READY":
            setMissingProfileOpen(true);
            toast.error(t("loading.profileNotReadyToast"));
            setState((s) => ({ ...s, step: 2 }));
            return;
          case "JOB_NOT_FOUND":
            toast.error(t("loading.jobNotFoundToast"));
            setState((s) => ({ ...s, step: 1, jobId: "", sourceType: null }));
            return;
          case "COVER_LETTER_ALREADY_EXISTS":
            toast.error(t("loading.alreadyExistsToast"));
            if (cle.existingCoverLetterId) {
              const job = eligibleJobs.data?.eligibleJobs.find(
                (j) => j.id === state.jobId,
              );
              setExistingClInfo({
                coverLetterId: cle.existingCoverLetterId,
                jobTitle: job?.title ?? "",
                company: job?.company ?? null,
                createdAt: new Date().toISOString(),
              });
              setExistingClOpen(true);
            }
            setState((s) => ({ ...s, step: 1, jobId: "", sourceType: null }));
            // Refresh eligible-jobs so the conflicting job drops out of the
            // dropdown.
            queryClient.invalidateQueries({
              queryKey: queryKeys.coverLetters.eligibleJobs(),
            });
            return;
          case "AI_FAILED":
            toast.error(t("loading.aiFailToast"));
            setState((s) => ({ ...s, step: 2 }));
            return;
          case "OUT_OF_QUOTA":
            // MONETIZE-14 — `cle.creditError` is the parsed 402 envelope
            // (CL_CREDITS_EXCEEDED). The modal infers title/body from the
            // reason code; we just hand it the typed object.
            if (cle.creditError) {
              upgrade.openFromCreditError(cle.creditError);
            }
            setState((s) => ({ ...s, step: 2 }));
            return;
          case "RATE_LIMITED":
            // MONETIZE-15 — anti-abuse 429. Distinct modal from upgrade because
            // upgrading does NOT lift this limit (PRD §12.6).
            if (cle.rateLimitError) {
              rateLimit.openFromRateLimitError(cle.rateLimitError);
            }
            setState((s) => ({ ...s, step: 2 }));
            return;
          case "TAILORED_RESUME_NOT_FOUND":
            // Edge case — the TR check passed in Step 1 but the backend
            // disagrees (race or stale cache). Fall back to Profile.
            toast.error(t("loading.aiFailToast"));
            setState((s) => ({ ...s, step: 2, sourceType: "profile" }));
            return;
          default:
            toast.error(t("loading.networkFailToast"));
            setState((s) => ({ ...s, step: 2 }));
        }
      }, 600);
    }
  }, [state.jobId, state.sourceType, generateMut, t, upgrade, rateLimit, queryClient, eligibleJobs.data]);

  const handleFinalize = React.useCallback(async () => {
    try {
      const cl = await finalizeMut.mutateAsync();
      toast.success(t("step3.saveSuccess"));
      router.replace(`/dashboard/cover-letters/${cl.id}`);
    } catch (err) {
      if (err instanceof CoverLetterError) {
        if (err.code === "COVER_LETTER_ALREADY_EXISTS") {
          toast.error(t("step3.saveConflict"));
          if (err.existingCoverLetterId) {
            router.replace(`/dashboard/cover-letters/${err.existingCoverLetterId}`);
          } else {
            router.replace("/dashboard/cover-letters");
          }
          return;
        }
      }
      toast.error(t("step3.saveError"));
    }
  }, [finalizeMut, router, t]);

  // ---- Source-type defaults: when TR check resolves --------------------
  React.useEffect(() => {
    if (!state.jobId) return;
    if (trCheck.isLoading) return;
    // If TR exists, default to tailored_resume. If 204 (data === null) or
    // error, fall back to profile.
    if (state.sourceType === null) {
      if (trCheck.data) {
        setState((s) => ({ ...s, sourceType: "tailored_resume" }));
      } else {
        setState((s) => ({ ...s, sourceType: "profile" }));
      }
    }
  }, [state.jobId, state.sourceType, trCheck.isLoading, trCheck.data]);

  // ---- ARIA live announcement for step transitions ---------------------
  const liveRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!liveRef.current) return;
    const labels: Record<string, string> = {
      "1": "Step 1 of 3, Select Job and Source.",
      "2": "Step 2 of 3, Generation Settings.",
      "3": "Step 3 of 3, Review Variants.",
    };
    const k = String(state.step);
    if (labels[k]) liveRef.current.textContent = labels[k];
  }, [state.step]);

  // ---- Render ----------------------------------------------------------

  // The Loading overlay is a sibling of the wizard chrome; spec §4.1.
  if (state.step === "loading") {
    return (
      <>
        <WizardLoading isError={generateMut.isError} />
        <div ref={liveRef} aria-live="polite" className="sr-only" />
      </>
    );
  }

  const currentStepNum: 1 | 2 | 3 = state.step;
  const cardWidth = currentStepNum === 3 ? "max-w-[860px]" : "max-w-[720px]";

  return (
    <div className="space-y-8">
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Back link */}
      <Link
        href="/dashboard/cover-letters"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </Link>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center">
        <StepIndicator current={currentStepNum} />
      </div>

      {/* Step body */}
      <div className={cn("mx-auto w-full", cardWidth)}>
        {state.step === 1 && (
          <Step1JobSource
            jobId={state.jobId}
            sourceType={state.sourceType}
            additionalContext={state.additionalContext}
            profileReady={profileReady}
            eligibleJobsQuery={eligibleJobs}
            trCheck={trCheck}
            onJobChange={(id) =>
              setState((s) => ({ ...s, jobId: id, sourceType: null }))
            }
            onSourceChange={(t) => setState((s) => ({ ...s, sourceType: t }))}
            onContextChange={(v) =>
              setState((s) => ({ ...s, additionalContext: v }))
            }
            onCancel={() => router.push("/dashboard/cover-letters")}
            onNext={() => setState((s) => ({ ...s, step: 2 }))}
            onPickConflictingJob={(info) => {
              setExistingClInfo(info);
              setExistingClOpen(true);
            }}
          />
        )}

        {state.step === 2 && (
          <Step2Settings
            style={state.style}
            tone={state.tone}
            length={state.length}
            onStyleChange={(v) => setState((s) => ({ ...s, style: v }))}
            onToneChange={(v) => setState((s) => ({ ...s, tone: v }))}
            onLengthChange={(v) => setState((s) => ({ ...s, length: v }))}
            onBack={() => setState((s) => ({ ...s, step: 1 }))}
            onGenerate={handleGenerate}
          />
        )}

        {state.step === 3 && (
          <Step3Variants
            variants={state.variants}
            selectedVariantIdx={state.selectedVariantIdx}
            isFinalizing={finalizeMut.isPending}
            onSelectVariant={(idx) =>
              setState((s) => ({ ...s, selectedVariantIdx: idx }))
            }
            onFinalize={handleFinalize}
          />
        )}
      </div>

      {/* Modals */}
      <MissingProfileDialog
        open={missingProfileOpen}
        onClose={() => setMissingProfileOpen(false)}
      />
      <ExistingCoverLetterDialog
        open={existingClOpen}
        info={existingClInfo}
        onClose={() => setExistingClOpen(false)}
      />
      {upgrade.modalState && (
        <UpgradeModal
          open={upgrade.modalState.open}
          onClose={upgrade.close}
          reason={upgrade.modalState.reason}
          currentCount={upgrade.modalState.currentCount}
          planLimit={upgrade.modalState.planLimit}
          resetAt={upgrade.modalState.resetAt}
        />
      )}
      {rateLimit.modalState && (
        <RateLimitModal
          open={rateLimit.modalState.open}
          onClose={rateLimit.close}
          retryAt={rateLimit.modalState.retryAt}
        />
      )}
    </div>
  );
}
