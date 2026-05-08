"use client";

/**
 * Complete Steps panel — DASHBOARD-1 (replaces the legacy <OnboardingChecklist />).
 *
 * Spec: docs/v2/specs/dashboard-home-spec.md §2
 *
 * Self-contained: derives every step's completion state from cached query data
 * (no new fetches besides the 3 net-new queries already mounted at page level).
 * Hides itself when all 4 steps are done OR the user has dismissed it.
 * Dismissal is server-persisted via POST /api/v1/users/me/dismiss-complete-steps
 * and surfaced through `user.complete_steps_dismissed_at`.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { queryKeys } from "@/hooks/api/keys";
import { useCoverLetters } from "@/hooks/api/useCoverLetters";
import { useProfile } from "@/hooks/api/useProfile";
import { useUser } from "@/hooks/api/useUser";
import { isProfileEmpty } from "@/lib/profile-api";
import {
  listTailoredResumes,
  type TailoredResumeListResponse,
} from "@/lib/tailored-resume-api";
import { dismissCompleteSteps, type CurrentUser } from "@/lib/user";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CompleteStepsPanelProps {
  /**
   * Total number of jobs the user has — used to decide whether the
   * tailor-resume / generate-cl steps deep-link to a specific job's detail
   * page or to /dashboard/jobs as a fallback. Threaded down from the page
   * because the parent already runs that query for Recent Activity; we
   * don't want to fire it twice.
   */
  mostRecentJobId: string | null;
  hasJobs: boolean | null;
  /** Total count from the same query (used as the create-job completion). */
  jobsTotal: number | null;
  jobsLoading: boolean;
}

// ---------------------------------------------------------------------------
// Step shape
// ---------------------------------------------------------------------------

interface Step {
  id: "upload-profile" | "create-job" | "tailor-resume" | "generate-cl";
  label: string;
  href: string;
  completed: boolean;
  completedHint: string;
  pendingHint: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompleteStepsPanel({
  mostRecentJobId,
  hasJobs,
  jobsTotal,
  jobsLoading,
}: CompleteStepsPanelProps) {
  const queryClient = useQueryClient();

  const { data: user, isPending: userLoading } = useUser();
  const { data: profile, isPending: profileLoading } = useProfile();
  const {
    data: tailoredResumesData,
    isPending: tailoredResumesLoading,
  } = useQuery<TailoredResumeListResponse>({
    // Reuse the same key the /dashboard/resumes list page uses so the cache
    // is shared — no double fetch when the user navigates between the two.
    queryKey: queryKeys.resumes.lists(),
    queryFn: () => listTailoredResumes({ limit: 100 }),
    staleTime: 1000 * 60 * 2,
  });
  const { data: coverLettersData, isPending: clLoading } = useCoverLetters();

  const stepsLoading =
    userLoading ||
    profileLoading ||
    jobsLoading ||
    tailoredResumesLoading ||
    clLoading;

  const dismissed = user?.complete_steps_dismissed_at != null;

  // ----- Mutation -----
  const dismissMutation = useMutation({
    mutationFn: dismissCompleteSteps,
    onSuccess: (data) => {
      // Optimistically write the new timestamp into the cached user so the
      // panel disappears on the next render even before the GET refetch lands.
      queryClient.setQueryData<CurrentUser | undefined>(
        queryKeys.user.me,
        (prev) =>
          prev
            ? { ...prev, complete_steps_dismissed_at: data.complete_steps_dismissed_at }
            : prev
      );
      // Re-fetch in the background to stay canonical.
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      toast.success("Get Started panel dismissed");
    },
    onError: () => {
      toast.error("Couldn't dismiss the panel. Try again.");
    },
  });

  // ----- Confirmation dialog state -----
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDismissClick() {
    setConfirmOpen(true);
  }

  function handleConfirmDismiss() {
    setConfirmOpen(false);
    dismissMutation.mutate();
  }

  // ----- Derive the 4 steps (must remain stable when loading) -----
  const steps: Step[] = useMemo(() => {
    const profileComplete = !isProfileEmpty(profile?.profile_data);
    const jobsCount = jobsTotal ?? 0;
    const resumesCount = tailoredResumesData?.total ?? 0;
    const clCount = coverLettersData?.total ?? 0;

    // Tailor / CL steps deep-link to the most recent job when one exists,
    // and degrade to /dashboard/jobs otherwise (spec §2.9 — no locked state).
    const jobLinkedHref = mostRecentJobId
      ? `/dashboard/jobs/${mostRecentJobId}`
      : "/dashboard/jobs";

    return [
      {
        id: "upload-profile",
        label: "Upload your resume to fill your profile",
        href: "/dashboard/profile",
        completed: profileComplete,
        completedHint: "Resume parsed and saved",
        pendingHint: "We'll extract your experience automatically",
      },
      {
        id: "create-job",
        label: "Create your first job",
        href: "/dashboard/jobs/new",
        completed: jobsCount >= 1,
        completedHint:
          jobsCount === 1 ? "Tracking 1 job" : `Tracking ${jobsCount} jobs`,
        pendingHint: "Paste a job description and we'll structure it for you",
      },
      {
        id: "tailor-resume",
        label: "Tailor a resume for that job",
        href: hasJobs ? jobLinkedHref : "/dashboard/jobs",
        completed: resumesCount >= 1,
        completedHint:
          resumesCount === 1
            ? "1 tailored resume ready"
            : `${resumesCount} tailored resumes ready`,
        pendingHint: "Pick a job and click \"Tailor resume\"",
      },
      {
        id: "generate-cl",
        label: "Generate a cover letter",
        href: hasJobs ? jobLinkedHref : "/dashboard/jobs",
        completed: clCount >= 1,
        completedHint:
          clCount === 1
            ? "1 cover letter ready"
            : `${clCount} cover letters ready`,
        pendingHint: "Use the same job to draft your cover letter",
      },
    ];
  }, [
    profile,
    jobsTotal,
    tailoredResumesData,
    coverLettersData,
    mostRecentJobId,
    hasJobs,
  ]);

  const completed = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const allDone = completed === total;

  // Hide cases (must come AFTER all hooks).
  if (dismissed) return null;
  // Auto-hide when fully complete — purely client-side, no POST. Spec §2.12.
  if (!stepsLoading && allDone) return null;

  // Loading skeleton — same dimensions as the loaded panel (no layout shift).
  if (stepsLoading) {
    return <CompleteStepsSkeleton />;
  }

  const progressValue = total > 0 ? (completed / total) * 100 : 0;

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-5 sm:p-6">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-2.5 min-w-0">
              <Sparkles
                size={18}
                className="text-primary shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Get Started
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Finish setting up your workspace
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissClick}
              disabled={dismissMutation.isPending}
              className="text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors shrink-0 -mt-1 -mr-1 p-1 rounded-md"
              aria-label="Dismiss Get Started panel"
            >
              <X size={15} />
            </button>
          </div>

          {/* Progress */}
          <p className="text-xs text-muted-foreground mb-2">
            <span className="font-medium text-foreground">
              {completed} of {total}
            </span>{" "}
            complete
          </p>
          <Progress
            value={progressValue}
            className="h-1.5 bg-muted"
            aria-label={`${completed} of ${total} steps completed`}
          />

          <Separator className="my-4 bg-border" />

          {/* Step list */}
          <ul className="flex flex-col gap-3" role="list">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Dismiss confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide the Get Started panel?</DialogTitle>
            <DialogDescription>
              You can&apos;t bring it back from the dashboard. Any incomplete
              steps will still be reachable from the sidebar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmDismiss}
              disabled={dismissMutation.isPending}
            >
              Hide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// StepRow
// ---------------------------------------------------------------------------

function StepRow({ step }: { step: Step }) {
  if (step.completed) {
    return (
      <li
        className="flex items-start gap-3"
        data-completed="true"
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary mt-0.5"
          aria-hidden="true"
        >
          <Check
            size={12}
            className="text-primary-foreground"
            strokeWidth={3}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground line-through">
            {step.label}
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {step.completedHint}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex items-start gap-3"
      data-completed="false"
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 mt-0.5"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <Link
          href={step.href}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>{step.label}</span>
          <ArrowRight
            size={13}
            className="text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          />
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {step.pendingHint}
        </p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CompleteStepsSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2.5 flex-1">
            <Skeleton className="h-[18px] w-[18px] rounded mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-5 w-5 rounded shrink-0" />
        </div>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-1.5 w-full mb-4" />
        <Separator className="my-4 bg-border" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
