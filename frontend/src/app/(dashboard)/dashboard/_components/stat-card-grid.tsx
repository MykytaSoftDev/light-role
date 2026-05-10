"use client";

/**
 * 4-card mini stats grid — DASHBOARD-1.
 *
 * Spec: docs/v2/specs/dashboard-home-spec.md §3
 *
 * Replaces the previous (Active Jobs / This Month / AI Operations / Days Until
 * Reset) layout with the per-tier (Free / Pro / Unlimited) layout from PRD §3.7.
 *
 * Per-tier rules:
 *   - Free / Pro: render `{used} / {limit}` with a muted denominator.
 *   - Unlimited: render `{used}` followed by an Infinity icon.
 *   - Active Jobs on Pro: no denominator (no quota).
 *
 * Data flows in via props from the parent page so all 4 cards share a single
 * usage + subscription fetch (no N+1).
 */

import {
  Briefcase,
  Calendar,
  FileText,
  Infinity as InfinityIcon,
  Mail,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types — the parent passes a fully-resolved `usage` + `subscription` snapshot.
// ---------------------------------------------------------------------------

export interface StatCardGridUsage {
  active_jobs_count: number;
  resume_credits_used: number;
  resume_credits_limit: number; // -1 = unlimited
  cl_credits_used: number;
  cl_credits_limit: number; // -1 = unlimited
  reset_date: string;
}

export type PlanTier = "free" | "pro" | "unlimited";

interface StatCardGridProps {
  usage: StatCardGridUsage;
  plan: PlanTier;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntilReset(resetDateStr: string): number {
  const resetDate = new Date(resetDateStr);
  const now = new Date();
  return Math.ceil(
    (resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatResetDate(resetDateStr: string): string {
  return new Date(resetDateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function usePlanSubLine() {
  const tBadge = useTranslations("Sidebar.planBadge");
  return (plan: PlanTier): string => {
    if (plan === "pro") return tBadge("proPlan");
    if (plan === "unlimited") return tBadge("unlimitedPlan");
    return tBadge("freePlan");
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatCardGrid({ usage, plan }: StatCardGridProps) {
  const t = useTranslations("DashboardHome.statCards");
  const planSubLine = usePlanSubLine();
  const sub = planSubLine(plan);
  const days = daysUntilReset(usage.reset_date);

  // Free hardcodes 10 active jobs (PRD); Pro / Unlimited have no cap to display.
  const activeJobsValue =
    plan === "free" ? (
      <RatioValue used={usage.active_jobs_count} limit={10} />
    ) : plan === "unlimited" ? (
      <UnlimitedValue used={usage.active_jobs_count} />
    ) : (
      <PlainValue used={usage.active_jobs_count} />
    );

  // Resume / CL credit cards: Free / Pro show denominator, Unlimited shows ∞.
  const resumeCreditsValue =
    usage.resume_credits_limit === -1 ? (
      <UnlimitedValue used={usage.resume_credits_used} />
    ) : (
      <RatioValue
        used={usage.resume_credits_used}
        limit={usage.resume_credits_limit}
      />
    );

  const clCreditsValue =
    usage.cl_credits_limit === -1 ? (
      <UnlimitedValue used={usage.cl_credits_used} />
    ) : (
      <RatioValue
        used={usage.cl_credits_used}
        limit={usage.cl_credits_limit}
      />
    );

  return (
    <TooltipProvider delayDuration={400}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Briefcase size={14} />}
          label={t("activeJobs")}
          value={activeJobsValue}
          sub={sub}
          tooltip={t("activeJobsTooltip")}
        />
        <StatCard
          icon={<FileText size={14} />}
          label={t("resumeCredits")}
          value={resumeCreditsValue}
          sub={sub}
          tooltip={t("resumeCreditsTooltip")}
        />
        <StatCard
          icon={<Mail size={14} />}
          label={t("clCredits")}
          value={clCreditsValue}
          sub={sub}
          tooltip={t("clCreditsTooltip")}
        />
        <StatCard
          icon={<Calendar size={14} />}
          label={t("daysUntilReset", { count: days > 0 ? days : 0 })}
          value={
            <PlainValue
              used={days > 0 ? days : 0}
              suffix={days > 0 ? t("daysSuffix") : null}
              todayLabel={days > 0 ? null : t("todayLabel")}
            />
          }
          sub={t("resetsOn", { date: formatResetDate(usage.reset_date) })}
          tooltip={t("daysUntilResetTooltip")}
        />
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Card primitive — Tailwind classes mirror the existing v2 card surface
// (`bg-card flex flex-col gap-1 rounded-xl border p-5`).
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tooltip?: string;
}

function StatCard({ icon, label, value, sub, tooltip }: StatCardProps) {
  // The value is rendered inside a <div> (not <p>) because some `value`
  // children include block-level wrappers (RatioValue/UnlimitedValue render
  // <span> trees that nest deeply); keeping the wrapper a div avoids any
  // future invalid-DOM trap. When wrapped in a Tooltip we use a <button>
  // trigger so it is keyboard-focusable on its own (per spec §7.6 — tooltip
  // content reachable via Tab).
  const valueClassName =
    "text-foreground text-3xl font-bold leading-none";
  const valueNode = <div className={valueClassName}>{value}</div>;

  return (
    <div
      data-slot="card"
      className="bg-card flex flex-col gap-1 rounded-xl border p-5"
    >
      <div className="text-muted-foreground mb-1 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-foreground text-3xl font-bold leading-none w-fit text-left cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {value}
            </button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        valueNode
      )}
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value renderers
// ---------------------------------------------------------------------------

function RatioValue({ used, limit }: { used: number; limit: number }) {
  return (
    <>
      {used}
      <span className="text-muted-foreground/60 text-2xl font-medium ml-1">
        / {limit}
      </span>
    </>
  );
}

function UnlimitedValue({ used }: { used: number }) {
  const t = useTranslations("DashboardHome.statCards");
  return (
    <span className="inline-flex items-baseline gap-2">
      {used}
      <InfinityIcon
        size={20}
        className="text-muted-foreground/70"
        aria-label={t("unlimited")}
      />
    </span>
  );
}

interface PlainValueProps {
  used: number;
  suffix?: string | null;
  /** Override label for the "0 days" case. */
  todayLabel?: string | null;
}

function PlainValue({ used, suffix, todayLabel }: PlainValueProps) {
  if (todayLabel) return <>{todayLabel}</>;
  if (suffix) {
    return (
      <>
        {used}{" "}
        <span className="text-muted-foreground/60 text-2xl font-medium">
          {suffix}
        </span>
      </>
    );
  }
  return <>{used}</>;
}

// ---------------------------------------------------------------------------
// Skeleton — kept here so the parent has a single import.
// ---------------------------------------------------------------------------

export function StatCardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          data-slot="card"
          className="bg-card flex flex-col gap-3 rounded-xl border p-5"
        >
          <div className="bg-muted-foreground/10 animate-pulse rounded h-4 w-24" />
          <div className="bg-muted-foreground/10 animate-pulse rounded h-8 w-16" />
          <div className="bg-muted-foreground/10 animate-pulse rounded h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
