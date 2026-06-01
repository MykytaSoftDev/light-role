"use client";

/**
 * CL-4 — Step 1: Select Job & Source.
 *
 * Three controls (Job, Source, Additional Context) + footer (Cancel, Next).
 *
 * The Source control is dynamic per spec §2.4:
 *   - TR exists for the selected job → Select with 2 options (default TR).
 *   - No TR → Alert info-block (sourceType implicitly "profile").
 *
 * Job + Source loading states use Skeleton; jobs error uses destructive Alert
 * with a retry button.
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, FileText, Info, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { JobOption } from "@/lib/jobs-api";
import type { CoverLetterListItem } from "@/types/cover-letter";
import type { TailoredResume } from "@/lib/tailored-resume-api";
import type { CoverLetterSourceType } from "@/lib/cover-letter-api";

const MAX_CONTEXT_LENGTH = 500;

interface ExistingClInfo {
  coverLetterId: string;
  jobTitle: string;
  company: string | null;
  createdAt: string;
}

interface EligibleJobsResult {
  eligibleJobs: JobOption[];
  coverLettersByJobId: Map<string, CoverLetterListItem>;
}

interface Step1Props {
  jobId: string;
  sourceType: CoverLetterSourceType | null;
  additionalContext: string;
  profileReady: boolean;
  eligibleJobsQuery: UseQueryResult<EligibleJobsResult>;
  trCheck: UseQueryResult<TailoredResume | null>;
  onJobChange: (id: string) => void;
  onSourceChange: (t: CoverLetterSourceType) => void;
  onContextChange: (v: string) => void;
  onCancel: () => void;
  onNext: () => void;
  /** Used when the user picks a job that already has a CL (defensive — the
   *  filtered dropdown should prevent this, but mid-session another tab may
   *  finalize a CL while the cache is stale). */
  onPickConflictingJob: (info: ExistingClInfo) => void;
}

export function Step1JobSource({
  jobId,
  sourceType,
  additionalContext,
  profileReady,
  eligibleJobsQuery,
  trCheck,
  onJobChange,
  onSourceChange,
  onContextChange,
  onCancel,
  onNext,
  onPickConflictingJob,
}: Step1Props) {
  const t = useTranslations("coverLetters.wizard");

  const eligibleJobs = eligibleJobsQuery.data?.eligibleJobs ?? [];
  const isLoadingJobs = eligibleJobsQuery.isLoading;
  const isJobsError = eligibleJobsQuery.isError;
  const isEmpty =
    !isLoadingJobs && !isJobsError && eligibleJobs.length === 0;

  // The TR check resolves into one of: loading, has TR (200), no TR (204
  // → null), error (treat as no TR per spec §2.4.2.D).
  const hasTr = !!trCheck.data;
  const trLoading = !!jobId && trCheck.isLoading;

  const counterColor =
    additionalContext.length >= MAX_CONTEXT_LENGTH
      ? "text-destructive"
      : additionalContext.length >= 480
        ? "text-amber-600 dark:text-amber-500"
        : "text-muted-foreground";

  function handleJobChange(newJobId: string) {
    // Defensive: if the user (somehow — stale cache) picks a job that has a
    // CL, surface the dialog instead of advancing.
    const conflict =
      eligibleJobsQuery.data?.coverLettersByJobId.get(newJobId);
    if (conflict) {
      onPickConflictingJob({
        coverLetterId: conflict.id,
        jobTitle: conflict.name,
        company: null,
        createdAt: conflict.created_at,
      });
      return;
    }
    onJobChange(newJobId);
  }

  const nextDisabled =
    !jobId ||
    !sourceType ||
    trLoading ||
    isJobsError ||
    !profileReady;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("step1.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job */}
        <div className="space-y-2">
          <Label className={cn(isEmpty && "sr-only")}>{t("step1.jobLabel")}</Label>

          {isLoadingJobs ? (
            <Skeleton className="h-9 w-full rounded-md" />
          ) : isJobsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{t("step1.jobsError")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => eligibleJobsQuery.refetch()}
                >
                  {t("step1.jobsErrorRetry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : isEmpty ? (
            <div className="space-y-3 rounded-md border border-dashed border-border p-6 text-center text-sm">
              <p className="font-medium text-foreground">
                {t("step1.empty.title")}
              </p>
              <p className="text-muted-foreground">{t("step1.empty.body")}</p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/dashboard/jobs/new">{t("step1.empty.cta")}</Link>
              </Button>
            </div>
          ) : (
            <Select value={jobId} onValueChange={handleJobChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("step1.jobPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {eligibleJobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.company ? `${j.title}, ${j.company}` : j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!profileReady && !isEmpty && (
            <p className="text-xs text-muted-foreground">
              {t("step1.profileHint")}
            </p>
          )}
        </div>

        {/* Source — visible only when a job is selectable */}
        {!isEmpty && jobId && (
          <div className="space-y-2">
            <Label>{t("step1.sourceLabel")}</Label>

            {trLoading ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : hasTr ? (
              <Select
                value={sourceType ?? ""}
                onValueChange={(v) =>
                  onSourceChange(v as CoverLetterSourceType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("step1.sourcePlaceholder")}>
                    {sourceType === "tailored_resume" && (
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {t("step1.source.tr.label")}
                      </span>
                    )}
                    {sourceType === "profile" && (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t("step1.source.profile.label")}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tailored_resume">
                    <div className="flex items-start gap-2 py-1">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          {t("step1.source.tr.label")}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t("step1.source.tr.sub")}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="profile">
                    <div className="flex items-start gap-2 py-1">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          {t("step1.source.profile.label")}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t("step1.source.profile.sub")}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>{t("step1.noTr.title")}</AlertTitle>
                <AlertDescription>{t("step1.noTr.body")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Additional Context — visible only when a job is selectable */}
        {!isEmpty && jobId && (
          <div className="space-y-2">
            <Label>
              {t("step1.contextLabel")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("step1.contextOptional")}
              </span>
            </Label>
            <Textarea
              value={additionalContext}
              onChange={(e) => {
                const next = e.target.value;
                onContextChange(
                  next.length > MAX_CONTEXT_LENGTH
                    ? next.slice(0, MAX_CONTEXT_LENGTH)
                    : next,
                );
              }}
              maxLength={MAX_CONTEXT_LENGTH}
              rows={4}
              className="resize-none"
              placeholder={t("step1.contextPlaceholder")}
            />
            <p className={cn("text-right text-xs", counterColor)}>
              {t("step1.contextCounter", { count: additionalContext.length })}
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          className={cn(
            "flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row",
            isEmpty ? "sm:justify-end" : "sm:justify-end",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          {!isEmpty && (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={nextDisabled}
              onClick={onNext}
            >
              {t("common.next")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
