"use client";

/**
 * TAILOR-6 — Tailor Wizard form (client).
 *
 * One-step form: pick a Job, click Tailor Now. The actual POST happens on
 * the loading route; this page only validates the gates that can be checked
 * client-side (profile readiness, quota stub) and routes to /loading.
 *
 * Existing-tailored-resume detection: deferred to the loading route's 409
 * response. The spec called for a `GET /api/v1/jobs/{id}/tailored-resume`
 * pre-flight check, but that endpoint does not exist on the backend yet.
 * Submitting and letting the API surface the 409 is robust and idempotent.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProfile } from "@/hooks/api/useProfile";
import { listJobs, type JobOption } from "@/lib/jobs-api";
import { queryKeys } from "@/hooks/api/keys";
import { cn } from "@/lib/utils";

import { MissingProfileDialog } from "./missing-profile-dialog";

// ---------------------------------------------------------------------------
// Profile-readiness rule (mirrors backend `_profile_is_ready` in jobs.py)
// ---------------------------------------------------------------------------

function isProfileReadyForTailoring(
  data: ReturnType<typeof useProfile>["data"]
): boolean {
  if (!data?.profile_data) return false;
  const employment = data.profile_data.employment ?? [];
  const projects = data.profile_data.projects ?? [];
  return employment.length > 0 || projects.length > 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TailorWizardFormProps {
  initialJobId: string | null;
}

export function TailorWizardForm({ initialJobId }: TailorWizardFormProps) {
  const t = useTranslations("Resumes.tailor");
  const tCommon = useTranslations("Common.actions");
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = React.useState<string>(
    initialJobId ?? ""
  );
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false);

  // Profile readiness gate — runs on mount via the cached profile query.
  const profile = useProfile();

  // The "ready" check needs to run once profile loads. We open the modal
  // automatically; a manual close keeps the user on the wizard with submit
  // disabled (per spec §1.7.A — Esc/Cancel keeps the gate flagged).
  const profileReady = isProfileReadyForTailoring(profile.data);
  React.useEffect(() => {
    if (profile.isLoading) return;
    if (!profileReady) {
      setProfileDialogOpen(true);
    }
  }, [profile.isLoading, profileReady]);

  // Jobs dropdown.
  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list({ tailor: true }),
    queryFn: () => listJobs(),
    staleTime: 1000 * 60 * 2,
  });

  const jobs: JobOption[] = jobsQuery.data?.items ?? [];

  // TODO(Phase 5.1): quota check → render UpgradeModal here when
  // GET /api/v1/users/me/usage indicates the user is out of credits.
  //
  // MONETIZE-14/15 wiring lives at the loading-page level — the tailor POST
  // happens AFTER navigation to /dashboard/resumes/tailor/loading, which
  // mounts UpgradeModal + RateLimitModal and dispatches via the typed
  // `TailorError.creditError` / `rateLimitError` envelopes.

  function handleSubmit() {
    if (!selectedJobId) return;
    if (!profileReady) {
      setProfileDialogOpen(true);
      return;
    }
    router.push(`/dashboard/resumes/tailor/loading?job_id=${selectedJobId}`);
  }

  // ---- States --------------------------------------------------------------

  const isJobsLoading = jobsQuery.isLoading || profile.isLoading;
  const isJobsError = jobsQuery.isError;
  const isJobsEmpty = !isJobsLoading && !isJobsError && jobs.length === 0;
  const submitDisabled =
    !selectedJobId || !profileReady || isJobsLoading || isJobsError;

  return (
    <>
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("selectJob")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Job picker / states */}
            <div className="space-y-2">
              <Label
                htmlFor="job-select"
                className={cn(isJobsEmpty && "sr-only")}
              >
                {t("jobLabel")}
              </Label>

              {isJobsLoading ? (
                <div
                  className="h-9 w-full animate-pulse rounded-md bg-muted"
                  aria-hidden="true"
                />
              ) : isJobsError ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between gap-2">
                    <span>{t("jobsError")}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => jobsQuery.refetch()}
                    >
                      {tCommon("tryAgain")}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : isJobsEmpty ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm space-y-3">
                  <p className="font-medium text-foreground">{t("noJobs.title")}</p>
                  <p className="text-muted-foreground">{t("noJobs.body")}</p>
                  <Button asChild size="sm" className="mt-2">
                    <Link href="/dashboard/jobs">{t("noJobs.cta")}</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Select
                    value={selectedJobId}
                    onValueChange={setSelectedJobId}
                  >
                    <SelectTrigger id="job-select" aria-describedby="job-help">
                      <SelectValue placeholder={t("jobPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.company ? `${j.title} — ${j.company}` : j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p id="job-help" className="text-xs text-muted-foreground">
                    {t("jobHelp")}
                  </p>
                </>
              )}
            </div>

            {/* Action row */}
            {!isJobsEmpty && (
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => router.back()}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={submitDisabled}
                  onClick={handleSubmit}
                >
                  {t("submit")}
                </Button>
              </div>
            )}

            {isJobsEmpty && (
              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                >
                  {tCommon("cancel")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* A: Profile-not-ready (page-load gate) */}
      <MissingProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />

      {/* B: Existing-resume — detected reactively from the loading route's
          409 response (no pre-flight endpoint on the backend yet). */}
      {/* C: Quota — TODO(Phase 5.1) — add UpgradeModal here. */}
    </>
  );
}
