/**
 * CL-4..CL-7 — Cover Letter wizard (server shell).
 *
 * Renders the page header and a Suspense boundary around the client wizard.
 * The wizard owns all interactive state (step, selections, variants).
 *
 * Spec: docs/v2/specs/cover-letter-wizard-spec.md.
 *
 * The four logical steps share this single URL — only `?job_id=` is consumed
 * (for pre-fill). No `?step=` param: see spec §1.2.
 */
import { Suspense } from "react";

import { CoverLetterWizard } from "./_components/cover-letter-wizard";

export default async function GenerateCoverLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>;
}) {
  const { job_id } = await searchParams;

  return (
    <Suspense fallback={<WizardSkeleton />}>
      <CoverLetterWizard initialJobId={job_id ?? null} />
    </Suspense>
  );
}

function WizardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="space-y-1">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded bg-muted" />
      </div>
      <div className="mx-auto w-full max-w-[720px]">
        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
