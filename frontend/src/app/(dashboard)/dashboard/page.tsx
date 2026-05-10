"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  Clock,
  FileText,
  Mail,
  Plus,
  X,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { queryKeys } from "@/hooks/api/keys";
import { useUser } from "@/hooks/api/useUser";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { CompleteStepsPanel } from "./_components/complete-steps-panel";
import {
  StatCardGrid,
  StatCardGridSkeleton,
  type PlanTier,
} from "./_components/stat-card-grid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mirrors backend `app/schemas/usage.py:UsageResponse`. The `*_credits_*`
 * fields were added in DASHBOARD-1; `-1` on a `_limit` field signals
 * "unlimited" (consistent with `effective_limits.ai_operations`).
 */
interface UsageStats {
  ai_operations_used: number;
  ai_operations_limit: number;
  reset_date: string;
  active_jobs_count: number;
  applications_this_month: number;
  resume_credits_used: number;
  resume_credits_limit: number;
  cl_credits_used: number;
  cl_credits_limit: number;
}

interface Application {
  id: string;
  job_id: string;
  status: string;
  date_applied: string | null;
  follow_up_date: string | null;
  excitement_level: number | null;
  notes: string | null;
  resume_id: string | null;
  cover_letter_id: string | null;
  deadline: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  created_at: string;
  application: Application;
}

interface JobsResponse {
  items: Job[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useRelativeDate() {
  const t = useTranslations("DashboardHome.relativeDate");
  return (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("today");
    if (diffDays === 1) return t("yesterday");
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return t("weeksAgo", { count: weeks });
    }
    const months = Math.floor(diffDays / 30);
    return t("monthsAgo", { count: months });
  };
}

/**
 * Map the subscription's `plan_slug` to the discriminator the StatCardGrid
 * expects. Free is the defensive default when no subscription record exists
 * (matches backend behaviour for first-run users).
 */
function resolvePlanTier(planSlug: string | null | undefined): PlanTier {
  if (planSlug === "unlimited") return "unlimited";
  if (planSlug === "pro") return "pro";
  return "free";
}

// ---------------------------------------------------------------------------
// Skeleton helpers (kept inline — page-local; the new panel/grid use shadcn
// Skeleton directly via their own modules).
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-muted-foreground/10 animate-pulse rounded", className)}
    />
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info toast banner (neutral variant) — used when a Quick Action is locked.
// ---------------------------------------------------------------------------

function InfoBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("DashboardHome.quickActions");
  return (
    <div className="border-border bg-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg">
      <span className="text-foreground text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label={t("dismiss")}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick action card (unchanged — kept inline because it is page-local).
// ---------------------------------------------------------------------------

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  onDisabledClick?: () => void;
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  disabled,
  onDisabledClick,
}: QuickActionCardProps) {
  const t = useTranslations("DashboardHome.quickActions");
  const inner = (
    <div
      data-slot="card"
      className={cn(
        "group bg-card flex flex-col gap-3 rounded-xl border p-6 transition-all duration-200",
        disabled
          ? "cursor-pointer opacity-60"
          : "hover:border-primary/50 cursor-pointer hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          disabled
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors"
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-foreground font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      </div>
      <div
        className={cn(
          "mt-auto flex items-center gap-1 text-xs font-medium",
          disabled ? "text-muted-foreground" : "text-primary"
        )}
      >
        {t("getStarted")} <ArrowRight size={12} />
      </div>
    </div>
  );

  if (disabled) {
    return <div onClick={onDisabledClick}>{inner}</div>;
  }

  return <Link href={href}>{inner}</Link>;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const t = useTranslations("DashboardHome");
  const tQA = useTranslations("DashboardHome.quickActions");
  const tStats = useTranslations("DashboardHome.stats");
  const tActivity = useTranslations("DashboardHome.recentActivity");
  const relativeDate = useRelativeDate();

  // Banner message UI state for "add a job first" toast.
  const [banner, setBanner] = useState<string | null>(null);

  // User
  const { data: user, isPending: userLoading } = useUser();

  // Usage stats (drives the 4-card grid + the UsageBanner)
  const { data: usage, isPending: usageLoading } = useQuery<UsageStats>({
    queryKey: queryKeys.user.usage,
    queryFn: async () => {
      const res = await api.get("/api/v1/users/me/usage");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  // Subscription plan — defaults to Free when no record exists.
  const { data: subscriptionData } = useQuery<{ plan_slug: string }>({
    queryKey: queryKeys.user.subscription,
    queryFn: async () => {
      const res = await api.get("/api/v1/subscriptions/current");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // Recent jobs (also drives the create-job step + tailor/CL deep-link).
  const { data: jobsData, isPending: jobsLoading } = useQuery<JobsResponse>({
    queryKey: [...queryKeys.jobs.list({}), "recent"],
    queryFn: async () => {
      const res = await api.get(
        "/api/v1/jobs?limit=5&sort_by=created_at&sort_order=desc"
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  // ----- Derived values (cheap; computed every render) -----
  const recentJobs = jobsData?.items ?? [];
  const jobsTotal = jobsData?.total ?? null;
  const hasJobs = jobsData != null ? (jobsData.total ?? 0) > 0 : null;
  // Spec §2.9: deep-link to the user's most recent job when available.
  const mostRecentJobId = jobsData?.items?.[0]?.id ?? null;

  const planSlug = subscriptionData?.plan_slug ?? null;
  const planTier = resolvePlanTier(planSlug);
  const isFreePlan = planTier === "free";

  const greeting = userLoading
    ? null
    : user?.first_name
      ? t("greeting", { name: user.first_name })
      : t("greetingFallback");

  const summaryLine = (() => {
    if (usageLoading) return null;
    const active = usage?.active_jobs_count ?? 0;
    const month = usage?.applications_this_month ?? 0;
    return t("summaryLine", { activeCount: active, appCount: month });
  })();

  // ----- Section ordering (spec §1) -----
  // We can't compute the *exact* userState yet (depends on `completed` from
  // CompleteStepsPanel which lives inside that component). For ordering
  // purposes we only need a coarse cut: "show panel above Quick Actions" vs
  // "below Stat Cards" vs "hide". The dismissed/all-done logic inside the
  // panel returns null, so even if we render the panel in both positions
  // (we don't — pick one based on hasJobs) only the visible position
  // actually mounts content.
  //
  //   - hasJobs === false  → "new" → panel above Quick Actions.
  //   - hasJobs === true   → "returning" or "established" → panel below
  //                          Stat Cards (the panel itself returns null when
  //                          all 4 are done OR the user dismissed it, which
  //                          collapses to the "established" layout cleanly).
  //
  // While `hasJobs` is unknown (initial load), we render in the "below
  // stats" slot so a returning user doesn't see layout shift; new users
  // briefly see Quick Actions first then the panel jumps up — a better
  // failure mode than the inverse (returning users seeing onboarding
  // guidance flash above their pipeline).
  const panelAboveQuickActions = hasJobs === false;

  function handleLockedAction(label: string) {
    setBanner(tQA("lockedToast", { action: label }));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* Welcome */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-1">
        {userLoading ? (
          <>
            <SkeletonBlock className="h-8 w-48" />
            <SkeletonBlock className="mt-1 h-4 w-64" />
          </>
        ) : (
          <>
            <h1 className="text-foreground text-3xl font-bold">{greeting}</h1>
            {summaryLine && (
              <p className="text-muted-foreground mt-1 text-sm">{summaryLine}</p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Complete Steps — appears HERE for new users (0 jobs). Spec §1. */}
      {/* ------------------------------------------------------------------ */}
      {panelAboveQuickActions && (
        <CompleteStepsPanel
          mostRecentJobId={mostRecentJobId}
          hasJobs={hasJobs}
          jobsTotal={jobsTotal}
          jobsLoading={jobsLoading}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Quick action cards */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {tQA("heading")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickActionCard
            icon={<Plus size={20} />}
            title={tQA("createJob.title")}
            description={tQA("createJob.description")}
            href="/dashboard/jobs/new"
          />
          <QuickActionCard
            icon={<FileText size={20} />}
            title={tQA("tailorResume.title")}
            description={tQA("tailorResume.description")}
            href="/dashboard/resumes/tailor"
            disabled={hasJobs === false}
            onDisabledClick={() =>
              handleLockedAction(tQA("lockedActions.tailoring"))
            }
          />
          <QuickActionCard
            icon={<Mail size={20} />}
            title={tQA("generateCoverLetter.title")}
            description={tQA("generateCoverLetter.description")}
            href="/dashboard/cover-letters/generate"
            disabled={hasJobs === false}
            onDisabledClick={() =>
              handleLockedAction(tQA("lockedActions.generating"))
            }
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Statistics — 4-card grid (per-tier rules in StatCardGrid). */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {tStats("heading")}
        </h2>
        {usageLoading || usage == null ? (
          <StatCardGridSkeleton />
        ) : (
          <StatCardGrid usage={usage} plan={planTier} />
        )}

        {/* Upgrade nudge — Free plan, >= 80% of EITHER per-cycle credit used. */}
        {(() => {
          if (usageLoading || usage == null || !isFreePlan) return null;
          const resumeLimit = usage.resume_credits_limit;
          const clLimit = usage.cl_credits_limit;
          // Defensive: -1 means unlimited (shouldn't happen on Free, but skip
          // the nudge if it does — there's nothing to warn about).
          if (resumeLimit <= 0 || clLimit <= 0) return null;
          const resumeRatio = usage.resume_credits_used / resumeLimit;
          const clRatio = usage.cl_credits_used / clLimit;
          if (resumeRatio < 0.8 && clRatio < 0.8) return null;

          const resumeRemaining = Math.max(0, resumeLimit - usage.resume_credits_used);
          const clRemaining = Math.max(0, clLimit - usage.cl_credits_used);

          return (
            <div className="bg-primary/5 border-primary/20 mt-3 flex items-center justify-between rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-sm">
                {tStats("remainingThisCycle", {
                  resumes: resumeRemaining,
                  coverLetters: clRemaining,
                })}
              </p>
              <Button size="sm" variant="default" asChild>
                <Link href="/dashboard/upgrade">
                  <Zap className="mr-1 h-3.5 w-3.5" />
                  {tStats("upgrade")}
                </Link>
              </Button>
            </div>
          );
        })()}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Complete Steps — appears HERE for returning users (≥1 job). */}
      {/* The panel returns null when all 4 done OR dismissed, which collapses */}
      {/* this slot cleanly thanks to the wrapper's `gap-8`. */}
      {/* ------------------------------------------------------------------ */}
      {!panelAboveQuickActions && (
        <CompleteStepsPanel
          mostRecentJobId={mostRecentJobId}
          hasJobs={hasJobs}
          jobsTotal={jobsTotal}
          jobsLoading={jobsLoading}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Recent activity */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
            {tActivity("heading")}
          </h2>
          {!jobsLoading && recentJobs.length > 0 && (
            <Link
              href="/dashboard/jobs"
              className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
            >
              {tActivity("viewAll")} <ArrowRight size={11} />
            </Link>
          )}
        </div>

        <div data-slot="card" className="bg-card divide-border divide-y rounded-xl border">
          {jobsLoading ? (
            <div className="px-5 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <ActivityItemSkeleton key={i} />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Briefcase size={22} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-foreground font-semibold">
                  {tActivity("emptyTitle")}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {tActivity("emptyDescription")}
                </p>
              </div>
              <Link
                href="/dashboard/jobs/new"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                {tActivity("addFirst")}
              </Link>
            </div>
          ) : (
            recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="hover:bg-muted/40 group flex items-center gap-4 px-5 py-3.5 transition-colors"
              >
                <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Briefcase size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {tActivity("addedJob", {
                      company: job.company,
                      title: job.title,
                    })}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                    <Clock size={11} />
                    {relativeDate(job.created_at)}
                  </p>
                </div>
                <ArrowRight
                  size={15}
                  className="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Info banner */}
      {/* ------------------------------------------------------------------ */}
      {banner && <InfoBanner message={banner} onDismiss={() => setBanner(null)} />}
    </div>
  );
}
