"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSubscription, type SubscriptionDetail } from "@/lib/subscription-api";
import { api } from "@/lib/api";
import {
  AlertCircle,
  CircleAlert,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  description: string;
  date: string;
  amount: string;
  status: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

// ── Usage bar ───────────────────────────────────────────────────────────────

interface UsageBarProps {
  label: string;
  used: number;
  /** null = unlimited */
  limit: number | null;
}

function UsageBar({ label, used, limit }: UsageBarProps) {
  if (limit === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground font-medium">{label}</span>
          <span className="text-muted-foreground flex items-center gap-1">
            {used}
            <span className="mx-0.5">/</span>
            <InfinityIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        <Progress value={100} className="[&>div]:bg-primary/40" />
      </div>
    );
  }

  const pct = usagePercent(used, limit);
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <span
          className={
            isCritical
              ? "text-destructive"
              : isWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
          }
        >
          {used}/{limit}
        </span>
      </div>
      <Progress
        value={pct}
        className={
          isCritical
            ? "[&>div]:bg-destructive"
            : isWarning
              ? "[&>div]:bg-amber-500"
              : undefined
        }
      />
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? ""}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/15">Active</Badge>;
  }
  if (status === "cancelled") {
    return <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">Cancelled</Badge>;
  }
  if (status === "past_due") {
    return <Badge variant="destructive">Past Due</Badge>;
  }
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────

  async function load() {
    try {
      const [subData, txnRes] = await Promise.all([
        getSubscription(),
        api.get("/api/v1/subscriptions/transactions?per_page=3"),
      ]);
      setSub(subData);
      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.items ?? []);
      }
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await api.post("/api/v1/subscriptions/cancel");
      if (res.ok) {
        // Refresh subscription data
        const refreshed = await getSubscription();
        setSub(refreshed);
      }
    } catch {
      // non-critical — user can retry
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  }

  async function handleUpdatePaymentMethod() {
    try {
      const res = await api.post("/api/v1/subscriptions/portal-session");
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      // non-critical
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const isPro = (sub?.effective_plan ?? sub?.plan) === "pro";
  const isCancelled = sub?.status === "cancelled";
  const isPastDue = sub?.status === "past_due";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-foreground text-xl font-semibold">Subscription</h2>
        <p className="text-muted-foreground mt-1 text-sm">Manage your plan and billing.</p>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Unable to load your subscription information. Please try again.</span>
        </div>
      )}

      {/* Loading */}
      {!sub && !loadError && <PageSkeleton />}

      {/* ── FREE USER VIEW ── */}
      {sub && !isPro && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Current Plan</h3>
              <Badge variant="secondary">Free</Badge>
            </div>

            {/* Usage stats */}
            <div className="space-y-3">
              <UsageBar
                label="AI Operations"
                used={sub.current_usage.ai_operations}
                limit={sub.effective_limits?.ai_operations ?? sub.limits.ai_operations}
              />
              <UsageBar
                label="Active Jobs"
                used={sub.current_usage.active_jobs}
                limit={
                  sub.effective_limits != null
                    ? sub.effective_limits.active_jobs
                    : sub.limits.active_jobs
                }
              />
            </div>

            {/* Reset date */}
            {sub.reset_date && (
              <p className="text-muted-foreground text-sm">
                Usage resets:{" "}
                <span className="text-foreground">{formatDate(sub.reset_date)}</span>
              </p>
            )}

            {/* Upgrade CTA */}
            <Button asChild className="w-full">
              <Link href="/dashboard/checkout">
                <Zap className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── PRO USER VIEW ── */}
      {sub && isPro && (
        <div className="space-y-6">
          {/* Header row: plan name + status badge + cancel button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">Pro Plan</h3>
              <StatusBadge status={sub.status} />
            </div>
            {!isCancelled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
              >
                Cancel subscription
              </Button>
            )}
          </div>

          {/* Cancellation banner */}
          {isCancelled && sub.current_period_end && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Subscription cancels on{" "}
                <strong>{formatDate(sub.current_period_end)}</strong>. Pro access continues
                until then.
              </p>
            </div>
          )}

          {/* Past due banner */}
          {isPastDue && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-destructive">Payment failed</p>
                <p className="text-sm text-muted-foreground">
                  Update your payment method to keep Pro active.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpdatePaymentMethod}
                  className="border-destructive/40 text-destructive hover:bg-destructive/5"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Payment Method
                </Button>
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              {/* Next payment card */}
              <div className="rounded-lg border p-5 space-y-3">
                <h3 className="font-semibold text-sm">Next Payment</h3>
                {sub.current_period_end ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Due {formatDate(sub.current_period_end)}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUpdatePaymentMethod}
                      className="gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      Manage Payment Method
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isCancelled ? "No upcoming renewal." : "—"}
                  </p>
                )}
              </div>

              {/* Recent payments card */}
              <div className="rounded-lg border p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Recent Payments</h3>
                  <Link
                    href="/dashboard/settings/billing"
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No payment history yet.</p>
                ) : (
                  transactions.slice(0, 3).map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(txn.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{txn.amount}</p>
                        <Badge
                          variant={txn.status === "completed" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {txn.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right column: Plan details + usage */}
            <div>
              <div className="rounded-lg border p-5 space-y-4">
                <h3 className="font-semibold text-sm">Plan Details</h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">Pro</span>
                  </div>
                  {sub.current_period_start && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span>{formatDate(sub.current_period_start)}</span>
                    </div>
                  )}
                  {sub.current_period_start && sub.current_period_end && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">Current period</span>
                      <span className="text-right">
                        {formatDate(sub.current_period_start)} –{" "}
                        {formatDate(sub.current_period_end)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Usage stats */}
                <div className="pt-2 border-t space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Usage this month
                  </p>
                  <UsageBar
                    label="AI Operations"
                    used={sub.current_usage.ai_operations}
                    limit={
                      sub.effective_limits?.ai_operations === -1 ||
                      sub.effective_limits?.ai_operations == null
                        ? null
                        : sub.effective_limits.ai_operations
                    }
                  />
                  <UsageBar
                    label="Active Jobs"
                    used={sub.current_usage.active_jobs}
                    limit={
                      sub.effective_limits != null
                        ? sub.effective_limits.active_jobs
                        : sub.limits.active_jobs
                    }
                  />
                </div>

                {/* Re-subscribe CTA for cancelled users */}
                {isCancelled && (
                  <div className="pt-2 border-t">
                    <Button asChild className="w-full">
                      <Link href="/dashboard/checkout">
                        <Zap className="h-4 w-4 mr-2" />
                        Re-subscribe to Pro
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Your Pro access continues until{" "}
              <strong>{formatDate(sub?.current_period_end)}</strong>. After that, your account
              reverts to the Free plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep subscription
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
