"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Calendar, Crown, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  useCancelSubscription,
  useGrantPro,
  useResetAiOps,
  useResetBillingCycle,
} from "@/hooks/api/useAdmin";
import type { AdminLifetimeUsage } from "@/hooks/api/useAdmin";
import type { CurrentSubscription } from "@/hooks/api/useCurrentSubscription";
import type { UsageResponse } from "@/hooks/api/useUsage";
import { cn } from "@/lib/utils";

import { ConfirmActionModal } from "./confirm-action-modal";

interface AdminSubscriptionCardProps {
  userId: string;
  userEmail: string;
  subscription: CurrentSubscription | null;
  usage: UsageResponse;
  lifetimeUsage?: AdminLifetimeUsage;
}

const PLAN_BADGE: Record<
  string,
  { label: string; className: string; variant?: "secondary" | "outline" }
> = {
  free: { label: "Free", className: "", variant: "secondary" },
  pro: {
    label: "Pro",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  pro_annual: {
    label: "Pro Annual",
    className:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
};

function PlanBadge({
  slug,
  name,
}: {
  slug: string | null;
  name: string | null;
}) {
  if (!slug) return <span className="text-muted-foreground">—</span>;
  const cfg = PLAN_BADGE[slug];
  if (cfg) {
    if (cfg.variant) {
      return (
        <Badge variant={cfg.variant} className="text-sm">
          {cfg.label}
        </Badge>
      );
    }
    return <Badge className={`text-sm ${cfg.className}`}>{cfg.label}</Badge>;
  }
  return (
    <Badge variant="outline" className="text-sm">
      {name ?? slug}
    </Badge>
  );
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  trialing: "bg-sky-500",
  past_due: "bg-amber-500",
  cancelled: "bg-muted-foreground/60",
  paused: "bg-muted-foreground/60",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  cancelled: "Cancelled",
  paused: "Paused",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/60"}`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function relative(iso: string | null | undefined) {
  if (!iso) return null;
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function usageRow(
  label: string,
  used: number,
  limit: number | null,
  options: {
    unlimitedLabel?: string;
    lifetimeUsed?: number;
  } = {}
) {
  // limit semantics: `-1` (UsageResponse) or `null` (CurrentSubscription /
  // EffectiveLimits) → unlimited.
  const { unlimitedLabel = "Unlimited", lifetimeUsed } = options;
  const isUnlimited = limit === null || limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, (used / Math.max(1, limit!)) * 100);
  let barTint = "";
  if (!isUnlimited) {
    if (pct >= 90) barTint = "[&>div]:bg-destructive";
    else if (pct >= 75) barTint = "[&>div]:bg-amber-500";
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {used} / {isUnlimited ? unlimitedLabel : limit}
        </span>
      </div>
      <Progress value={pct} className={`h-2 ${barTint}`} />
      {lifetimeUsed !== undefined && (
        <div className="flex justify-end text-xs text-muted-foreground tabular-nums">
          {lifetimeUsed} lifetime
        </div>
      )}
    </div>
  );
}

type ActionKey = "grantPro" | "cancel" | "resetCycle" | "resetAiOps";

export function AdminSubscriptionCard({
  userId,
  userEmail,
  subscription,
  usage,
  lifetimeUsage,
}: AdminSubscriptionCardProps) {
  const planSlug = subscription?.plan_slug ?? usage.effective_plan ?? null;
  const planName = subscription?.plan_name ?? usage.plan_name ?? null;
  const status = subscription?.status ?? null;
  const scheduledChange = subscription?.scheduled_change ?? null;

  const periodStart = subscription?.current_period_start ?? null;
  const periodEnd = subscription?.current_period_end ?? null;

  // Which modal is open (or `null` if none). One-at-a-time keeps the local
  // state simple and avoids accidental double-open from misaligned booleans.
  const [openModal, setOpenModal] = useState<ActionKey | null>(null);

  // Grant Pro days input — kept on the parent so it survives child remounts
  // and so we can re-validate when the user reopens the modal.
  const [days, setDays] = useState<string>("30");
  const daysNum = Number(days);
  const daysInvalid = !Number.isFinite(daysNum) || daysNum < 1 || daysNum > 365;

  const grantPro = useGrantPro();
  const cancelSub = useCancelSubscription();
  const resetCycle = useResetBillingCycle();
  const resetAiOps = useResetAiOps();

  // Reset the per-mutation error state when a modal closes so reopening
  // doesn't show a stale message from a previous failure.
  const handleOpenChange =
    (key: ActionKey, reset: () => void) => (next: boolean) => {
      if (!next) {
        reset();
        // Reset the days field to default when the Grant Pro modal closes.
        if (key === "grantPro") setDays("30");
      }
      setOpenModal(next ? key : null);
    };

  const periodEndFormatted = periodEnd
    ? format(new Date(periodEnd), "MMM d, yyyy")
    : "the end of the current period";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription & usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlanBadge slug={planSlug} name={planName} />
            <StatusBadge status={status} />
          </div>
          <span className="text-xs text-muted-foreground">
            {scheduledChange
              ? "Cancels at period end"
              : subscription?.billing_cycle === "annual"
                ? "Renews annually"
                : status === "active"
                  ? "Renews monthly"
                  : null}
          </span>
        </div>

        <Separator className="my-4" />

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Cycle starts</dt>
          <dd className="tabular-nums">{formatDate(periodStart)}</dd>
          <dt className="text-muted-foreground">Cycle ends</dt>
          <dd className="flex flex-col tabular-nums">
            <span>{formatDate(periodEnd)}</span>
            {periodEnd && (
              <span className="text-xs text-muted-foreground">
                {relative(periodEnd)}
              </span>
            )}
          </dd>
        </dl>

        <Separator className="my-4" />

        <div className="flex flex-col gap-4">
          {usageRow(
            "Resume credits (this cycle)",
            usage.resume_credits_used,
            usage.resume_credits_limit,
            { lifetimeUsed: lifetimeUsage?.resume_generations }
          )}
          {usageRow(
            "Cover letter credits (this cycle)",
            usage.cl_credits_used,
            usage.cl_credits_limit,
            { lifetimeUsed: lifetimeUsage?.cl_generations }
          )}
          {usageRow(
            "Active jobs",
            usage.active_jobs_count,
            usage.effective_limits.active_jobs
          )}
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            className="w-full"
            onClick={() => setOpenModal("grantPro")}
          >
            <Crown className="mr-2 h-4 w-4" />
            Grant Pro
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setOpenModal("resetAiOps")}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset AI ops
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setOpenModal("resetCycle")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Reset cycle
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setOpenModal("cancel")}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel subscription
          </Button>
        </div>
      </CardContent>

      {/* ── Grant Pro modal ──────────────────────────────────────────── */}
      <ConfirmActionModal
        open={openModal === "grantPro"}
        onOpenChange={handleOpenChange("grantPro", grantPro.reset)}
        icon={Crown}
        iconClassName="text-primary"
        actionName="Grant Pro"
        targetEmail={userEmail}
        description="Grants Pro access to this user for the chosen number of days. Extends any existing Pro time."
        confirmLabel="Grant Pro"
        confirmVariant="default"
        isPending={grantPro.isPending}
        disabled={daysInvalid}
        errorMessage={grantPro.error?.message ?? null}
        onConfirm={() => {
          grantPro.mutate(
            { userId, days: daysNum },
            {
              onSuccess: () => {
                toast.success(`Pro granted to ${userEmail}`);
                setOpenModal(null);
                grantPro.reset();
                setDays("30");
              },
            }
          );
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="grant-pro-days">Pro access duration</Label>
          <div className="flex items-center gap-2">
            <Input
              id="grant-pro-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p
            className={cn(
              "text-xs",
              daysInvalid ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {daysInvalid
              ? "Must be between 1 and 365."
              : "Between 1 and 365 days. Default 30."}
          </p>
        </div>
      </ConfirmActionModal>

      {/* ── Cancel Subscription modal ────────────────────────────────── */}
      <ConfirmActionModal
        open={openModal === "cancel"}
        onOpenChange={handleOpenChange("cancel", cancelSub.reset)}
        icon={XCircle}
        iconClassName="text-destructive"
        actionName="Cancel Subscription"
        targetEmail={userEmail}
        description={`Cancels the user's subscription. They retain Pro access until the current period ends (${periodEndFormatted}).`}
        confirmLabel="Cancel subscription"
        confirmVariant="destructive"
        isPending={cancelSub.isPending}
        errorMessage={cancelSub.error?.message ?? null}
        onConfirm={() => {
          cancelSub.mutate(
            { userId },
            {
              onSuccess: () => {
                toast.success(`Subscription cancelled for ${userEmail}`);
                setOpenModal(null);
                cancelSub.reset();
              },
            }
          );
        }}
      />

      {/* ── Reset Billing Cycle modal ────────────────────────────────── */}
      <ConfirmActionModal
        open={openModal === "resetCycle"}
        onOpenChange={handleOpenChange("resetCycle", resetCycle.reset)}
        icon={Calendar}
        iconClassName="text-amber-500"
        actionName="Reset Billing Cycle"
        targetEmail={userEmail}
        description="Resets the user's internal credit cycle anchor. Paddle billing cycles are not affected."
        confirmLabel="Reset cycle"
        confirmVariant="default"
        isPending={resetCycle.isPending}
        errorMessage={resetCycle.error?.message ?? null}
        onConfirm={() => {
          resetCycle.mutate(
            { userId },
            {
              onSuccess: () => {
                toast.success(`Billing cycle reset for ${userEmail}`);
                setOpenModal(null);
                resetCycle.reset();
              },
            }
          );
        }}
      />

      {/* ── Reset AI Ops modal ───────────────────────────────────────── */}
      <ConfirmActionModal
        open={openModal === "resetAiOps"}
        onOpenChange={handleOpenChange("resetAiOps", resetAiOps.reset)}
        icon={RotateCcw}
        iconClassName="text-amber-500"
        actionName="Reset AI Ops Counter"
        targetEmail={userEmail}
        description="Sets the user's AI operations used for the current cycle to 0."
        confirmLabel="Reset counter"
        confirmVariant="default"
        isPending={resetAiOps.isPending}
        errorMessage={resetAiOps.error?.message ?? null}
        onConfirm={() => {
          resetAiOps.mutate(
            { userId },
            {
              onSuccess: () => {
                toast.success(`AI ops counter reset for ${userEmail}`);
                setOpenModal(null);
                resetAiOps.reset();
              },
            }
          );
        }}
      />
    </Card>
  );
}
