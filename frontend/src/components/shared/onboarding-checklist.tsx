"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistStep {
  id: string;
  label: string;
  href: string;
  completed: boolean;
}

interface JobsResponse {
  items: Array<{ application: { status: string } }>;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSED_KEY = "onboarding_dismissed";
const HAS_RESUME_KEY = "has_uploaded_resume";
const HAS_CL_KEY = "has_generated_cl";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [loading, setLoading] = useState(true);

  // Read localStorage and fetch data on mount
  useEffect(() => {
    // Check dismissed state first
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      setDismissed(true);
      setLoading(false);
      return;
    }
    setDismissed(false);

    // Fetch jobs to determine step completion
    api
      .get("/api/v1/jobs?limit=50&sort_by=created_at&sort_order=desc")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: JobsResponse | null) => {
        const hasResume = localStorage.getItem(HAS_RESUME_KEY) === "true";
        const hasCL = localStorage.getItem(HAS_CL_KEY) === "true";

        const hasJob = (data?.total ?? 0) > 0;
        const hasApplied =
          (data?.items ?? []).some(
            (job) => job.application?.status !== "SAVED"
          ) ?? false;

        setSteps([
          {
            id: "upload-resume",
            label: "Upload a resume",
            href: "/dashboard/resumes",
            completed: hasResume,
          },
          {
            id: "create-job",
            label: "Create your first job",
            href: "/dashboard/jobs/new",
            completed: hasJob,
          },
          {
            id: "generate-cl",
            label: "Generate a cover letter",
            href: "/dashboard/cover-letters/generate",
            completed: hasCL,
          },
          {
            id: "apply-job",
            label: "Apply to a job",
            href: "/dashboard/jobs",
            completed: hasApplied,
          },
        ]);
      })
      .catch(() => {
        // On error, show all steps as incomplete so user can still navigate
        const hasResume = localStorage.getItem(HAS_RESUME_KEY) === "true";
        const hasCL = localStorage.getItem(HAS_CL_KEY) === "true";

        setSteps([
          {
            id: "upload-resume",
            label: "Upload a resume",
            href: "/dashboard/resumes",
            completed: hasResume,
          },
          {
            id: "create-job",
            label: "Create your first job",
            href: "/dashboard/jobs/new",
            completed: false,
          },
          {
            id: "generate-cl",
            label: "Generate a cover letter",
            href: "/dashboard/cover-letters/generate",
            completed: hasCL,
          },
          {
            id: "apply-job",
            label: "Apply to a job",
            href: "/dashboard/jobs",
            completed: false,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  // Don't render until localStorage check is done
  if (dismissed === null || loading) return null;

  // Hidden if dismissed
  if (dismissed) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  // Auto-hide when all steps are complete
  if (allDone) return null;

  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Getting Started
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          aria-label="Dismiss onboarding checklist"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden mb-4"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completedCount} of ${totalCount} steps completed`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step list */}
      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2.5">
            {step.completed ? (
              <>
                <CheckCircle2
                  size={17}
                  className="text-primary shrink-0"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-sm line-through text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </>
            ) : (
              <>
                <Circle
                  size={17}
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
                <Link
                  href={step.href}
                  className="text-sm text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {step.label}
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
