/**
 * TAILOR-6 — Tailor Resume Wizard (server shell).
 *
 * Renders the page header and a Suspense boundary around the client form.
 * The form owns all interactive state (job selection, modals) and submit
 * navigation to the loading screen.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §1.
 */
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TailorWizardForm } from "./_components/tailor-wizard-form";

export default async function TailorResumePage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>;
}) {
  const { job_id } = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/resumes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resumes
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tailor a new resume
        </h1>
        <p className="text-sm text-muted-foreground">
          AI tailors your profile to a specific job in ~30 seconds.
        </p>
      </div>

      <Suspense fallback={<TailorWizardSkeleton />}>
        <TailorWizardForm initialJobId={job_id ?? null} />
      </Suspense>
    </div>
  );
}

function TailorWizardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
