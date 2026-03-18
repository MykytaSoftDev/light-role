"use client";

import { OnboardingChecklist } from "@/components/shared/onboarding-checklist";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  Mail,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface UsageStats {
  ai_operations_used: number;
  ai_operations_limit: number;
  reset_date: string;
  active_jobs_count: number;
  applications_this_month: number;
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

function relativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function daysUntilReset(resetDateStr: string): number {
  const resetDate = new Date(resetDateStr);
  const now = new Date();
  return Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("bg-muted-foreground/10 animate-pulse rounded", className)} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-5">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-8 w-16" />
      <SkeletonBlock className="h-3 w-32" />
    </div>
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
// Info toast banner (neutral variant)
// ---------------------------------------------------------------------------

function InfoBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="border-border bg-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg">
      <span className="text-foreground text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-5">
      <div className="text-muted-foreground mb-1 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="text-foreground text-3xl font-bold">{value}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick action card
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
  const inner = (
    <div
      className={cn(
        "group bg-card flex flex-col gap-3 rounded-xl border p-6 transition-all duration-150",
        disabled
          ? "cursor-pointer opacity-60"
          : "hover:border-primary/50 cursor-pointer hover:shadow-sm"
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
        Get started <ArrowRight size={12} />
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
  const router = useRouter();

  // Data state
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [hasJobs, setHasJobs] = useState<boolean | null>(null);

  // Loading states
  const [userLoading, setUserLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Banner message
  const [banner, setBanner] = useState<string | null>(null);

  // Fetch user
  useEffect(() => {
    api
      .get("/api/v1/users/me")
      .then((res) => {
        if (res.ok) return res.json();
        if (res.status === 401) router.push("/auth/login");
        return null;
      })
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {})
      .finally(() => setUserLoading(false));
  }, [router]);

  // Fetch usage stats
  useEffect(() => {
    api
      .get("/api/v1/users/me/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  }, []);

  // Fetch recent jobs
  useEffect(() => {
    api
      .get("/api/v1/jobs?limit=5&sort_by=created_at&sort_order=desc")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: JobsResponse | null) => {
        if (data) {
          setRecentJobs(data.items ?? []);
          setHasJobs((data.total ?? 0) > 0);
        } else {
          setHasJobs(false);
        }
      })
      .catch(() => setHasJobs(false))
      .finally(() => setJobsLoading(false));
  }, []);

  // Derived values
  const greeting = userLoading
    ? null
    : user?.first_name
      ? `Hello, ${user.first_name}!`
      : "Welcome back!";

  const summaryLine = (() => {
    if (usageLoading) return null;
    const active = usage?.active_jobs_count ?? 0;
    const month = usage?.applications_this_month ?? 0;
    return `${active} active ${active === 1 ? "job" : "jobs"}, ${month} ${month === 1 ? "application" : "applications"} this month`;
  })();

  const aiRemaining =
    usage != null
      ? `${usage.ai_operations_limit - usage.ai_operations_used} of ${usage.ai_operations_limit}`
      : "—";

  const resetDays = usage?.reset_date != null ? daysUntilReset(usage.reset_date) : null;

  function handleLockedAction(label: string) {
    setBanner(`Add a job first before ${label}.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* Welcome section */}
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
            {summaryLine && <p className="text-muted-foreground mt-1 text-sm">{summaryLine}</p>}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Quick action cards */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickActionCard
            icon={<Plus size={20} />}
            title="Create a Job"
            description="Track a new application by adding a job listing."
            href="/dashboard/jobs/new"
          />
          <QuickActionCard
            icon={<FileText size={20} />}
            title="Tailor Resume"
            description="Optimize your resume for a specific job using AI."
            href="/dashboard/resumes/tailor"
            disabled={hasJobs === false}
            onDisabledClick={() => handleLockedAction("tailoring your resume")}
          />
          <QuickActionCard
            icon={<Mail size={20} />}
            title="Generate Cover Letter"
            description="Create a personalized cover letter with AI assistance."
            href="/dashboard/cover-letters/generate"
            disabled={hasJobs === false}
            onDisabledClick={() => handleLockedAction("generating a cover letter")}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Statistics */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          Your Stats
        </h2>
        {usageLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Briefcase size={14} />}
              label="Active Jobs"
              value={usage?.active_jobs_count ?? "—"}
              sub="currently tracking"
            />
            <StatCard
              icon={<TrendingUp size={14} />}
              label="This Month"
              value={usage?.applications_this_month ?? "—"}
              sub="applications submitted"
            />
            <StatCard
              icon={<FileText size={14} />}
              label="AI Operations"
              value={aiRemaining}
              sub="remaining this period"
            />
            <StatCard
              icon={<Calendar size={14} />}
              label="Days Until Reset"
              value={resetDays != null ? (resetDays > 0 ? resetDays : "Today") : "—"}
              sub={
                usage?.reset_date
                  ? `resets ${new Date(usage.reset_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}`
                  : undefined
              }
            />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Onboarding checklist */}
      {/* ------------------------------------------------------------------ */}
      <OnboardingChecklist />

      {/* ------------------------------------------------------------------ */}
      {/* Recent activity */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
            Recent Activity
          </h2>
          {!jobsLoading && recentJobs.length > 0 && (
            <Link
              href="/dashboard/jobs"
              className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View all <ArrowRight size={11} />
            </Link>
          )}
        </div>

        <div className="bg-card divide-border divide-y rounded-xl border">
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
                <p className="text-foreground font-semibold">No jobs yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Start tracking your job search by adding your first listing.
                </p>
              </div>
              <Link
                href="/dashboard/jobs/new"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                Add your first job
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
                    Added <span className="font-semibold">{job.company}</span>
                    {" — "}
                    {job.title}
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
