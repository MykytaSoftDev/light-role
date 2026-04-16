"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useJobs } from "@/hooks/api/useJobs";
import { useResumes } from "@/hooks/api/useResumes";
import { useCoverLetters } from "@/hooks/api/useCoverLetters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistStep {
  id: string;
  label: string;
  href: string;
  completed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSED_KEY = "onboarding_dismissed";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Read localStorage on mount to determine dismissed state
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
  }, []);

  const { data: jobsData, isLoading: jobsLoading } = useJobs(
    { limit: 50, sort_by: "created_at", sort_order: "desc" },
  );
  const { data: resumesData, isLoading: resumesLoading } = useResumes();
  const { data: clData, isLoading: clLoading } = useCoverLetters();

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  // Don't render until localStorage check and all queries are settled
  if (dismissed === null || jobsLoading || resumesLoading || clLoading) return null;

  // Hidden if dismissed
  if (dismissed) return null;

  const hasResume = (resumesData?.total ?? 0) > 0;
  const hasCL = (clData?.total ?? 0) > 0;
  const hasJob = (jobsData?.total ?? 0) > 0;
  // JobOption exposes a top-level `status` field (not nested under `application`)
  const hasApplied = (jobsData?.items ?? []).some((job) => job.status !== "SAVED") ?? false;

  const steps: ChecklistStep[] = [
    {
      id: "create-job",
      label: "Create your first job",
      href: "/dashboard/jobs/new",
      completed: hasJob,
    },
    {
      id: "upload-resume",
      label: "Upload a resume",
      href: "/dashboard/resumes",
      completed: hasResume,
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
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  // Auto-hide when all steps are complete
  if (allDone) return null;

  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <Card>
      <CardContent className="p-4">
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
      </CardContent>
    </Card>
  );
}
