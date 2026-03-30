"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  CircleAlert,
  CircleCheck,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface TransactionItem {
  id: string;
  date: string;
  amount: string | null;
  currency: string;
  status: string;
  description: string | null;
}

interface SubscriptionCurrentResponse {
  subscription_id: string | null;
  plan_name: string;
  plan_slug: string;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_payment: { amount: string | null; currency: string | null; date: string | null } | null;
  payment_method: { type: string; last4: string | null; brand: string | null } | null;
  ai_ops_used: number;
  ai_ops_limit: number;
  active_jobs: number;
  reset_date?: string | null;
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

// ai_ops_limit of -1 or 0 means unlimited for Pro
function resolveOpsLimit(limit: number): number | null {
  return limit <= 0 ? null : limit;
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
      {/* Plan card skeleton */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      {/* Usage card skeleton */}
      <div className="rounded-lg border p-5 space-y-4">
        <Skeleton className="h-4 w-24" />
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
      </div>
    </div>
  );
}

// ── Payments table ───────────────────────────────────────────────────────────

interface PaymentsTableProps {
  items: TransactionItem[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

function PaymentsTable({ items, hasMore, loading, onLoadMore }: PaymentsTableProps) {
  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">No payments yet.</div>
    );
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Date</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium hidden sm:table-cell">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((txn) => (
            <tr key={txn.id}>
              <td className="py-3 pr-4">{formatDate(txn.date)}</td>
              <td className="py-3 pr-4 font-medium">{txn.amount ?? "—"}</td>
              <td className="py-3 pr-4">
                <Badge
                  variant={
                    txn.status === "completed"
                      ? "default"
                      : txn.status === "refunded"
                        ? "secondary"
                        : "destructive"
                  }
                  className="capitalize"
                >
                  {txn.status}
                </Badge>
              </td>
              <td className="py-3 text-muted-foreground hidden sm:table-cell">
                {txn.description ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Load more
        </Button>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
  const [sub, setSub] = useState<SubscriptionCurrentResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // ── Load subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const res = await api.get("/api/v1/subscriptions/current");
      if (res.ok) {
        const data: SubscriptionCurrentResponse = await res.json();
        setSub(data);
        if (data.plan_slug === "pro") {
          loadTransactions(null, data.plan_slug);
        }
      } else {
        setLoadError("Unable to load your billing information. Please try again.");
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load transactions ──────────────────────────────────────────────────────

  async function loadTransactions(cursor: string | null, _planSlug?: string) {
    setLoadingTxns(true);
    const url = cursor
      ? `/api/v1/subscriptions/transactions?per_page=10&after=${cursor}`
      : "/api/v1/subscriptions/transactions?per_page=10";
    const res = await api.get(url);
    if (res.ok) {
      const data = await res.json();
      setTransactions((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setHasMore(data.has_more ?? false);
      setNextCursor(data.next_cursor ?? null);
    }
    setLoadingTxns(false);
  }

  // ── Update payment method via portal session ───────────────────────────────

  async function handleUpdatePaymentMethod() {
    setPortalLoading(true);
    try {
      const res = await api.post("/api/v1/subscriptions/portal-session");
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
      }
    } finally {
      setPortalLoading(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const isPro = sub?.plan_slug === "pro";
  const isCancelled = sub?.status === "cancelled";
  const isPastDue = sub?.status === "past_due";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-foreground text-xl font-semibold">Billing &amp; Subscription</h2>
        <p className="text-muted-foreground mt-1 text-sm">Manage your plan and usage limits.</p>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Past due banner */}
      {!loadError && sub && isPastDue && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="font-medium">Payment past due</p>
            <p>
              Your last payment could not be processed. Please update your payment method to keep
              your Pro plan active.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600 text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-amber-950"
              onClick={handleUpdatePaymentMethod}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Update Payment Method
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!sub && !loadError && <PageSkeleton />}

      {/* ── Loaded content ── */}
      {sub && (
        <div className="space-y-6">
          {/* ── PRO: Subscription summary card ── */}
          {isPro && (
            <div className="border-border bg-card space-y-3 rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-muted-foreground h-4 w-4" />
                  <h3 className="text-foreground text-sm font-semibold">Current Plan</h3>
                </div>
                <Badge className="bg-primary text-primary-foreground">Pro</Badge>
              </div>

              {/* Cancelled notice inline */}
              {isCancelled && sub.current_period_end && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Your Pro plan is active until{" "}
                    <strong>{formatDate(sub.current_period_end)}</strong>. After that, your account
                    will revert to the Free plan.
                  </span>
                </div>
              )}

              {/* Billing details */}
              <div className="text-muted-foreground space-y-0.5 text-sm">
                {sub.billing_cycle && (
                  <p>
                    Billing:{" "}
                    <span className="text-foreground capitalize">{sub.billing_cycle}</span>
                  </p>
                )}
                {sub.next_payment?.date && !isCancelled && (
                  <p>
                    Next payment:{" "}
                    <span className="text-foreground">{formatDate(sub.next_payment.date)}</span>
                    {sub.next_payment.amount && (
                      <span className="text-foreground">
                        {" "}
                        ({sub.next_payment.amount}{" "}
                        {sub.next_payment.currency?.toUpperCase() ?? ""})
                      </span>
                    )}
                  </p>
                )}
                {isCancelled && sub.current_period_end && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Active until {formatDate(sub.current_period_end)}
                  </p>
                )}
              </div>

              {/* Manage subscription link */}
              <div className="border-border border-t pt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/subscription">
                    <CreditCard className="h-4 w-4" />
                    Manage Subscription
                  </Link>
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  Update your payment method, view invoices, or cancel your subscription.
                </p>
              </div>
            </div>
          )}

          {/* ── FREE: Current plan card ── */}
          {!isPro && (
            <div className="border-border bg-card space-y-4 rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-muted-foreground h-4 w-4" />
                  <h3 className="text-foreground text-sm font-semibold">Current Plan</h3>
                </div>
                <Badge variant="secondary">Free</Badge>
              </div>

              {sub.reset_date && (
                <p className="text-muted-foreground text-sm">
                  Usage resets:{" "}
                  <span className="text-foreground">{formatDate(sub.reset_date)}</span>
                </p>
              )}
            </div>
          )}

          {/* ── Usage card (both plans) ── */}
          <div className="border-border bg-card space-y-4 rounded-lg border p-5">
            <h3 className="text-foreground text-sm font-semibold">Usage this month</h3>
            <div className="space-y-4">
              <UsageBar
                label="AI Operations"
                used={sub.ai_ops_used}
                limit={resolveOpsLimit(sub.ai_ops_limit)}
              />
              <UsageBar
                label="Active Jobs"
                used={sub.active_jobs}
                limit={null}
              />
            </div>
          </div>

          {/* ── FREE: Upgrade card ── */}
          {!isPro && (
            <div className="border-border bg-card space-y-4 rounded-lg border p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">Upgrade to Pro</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Unlock {sub.ai_ops_limit > 0 ? "150" : "more"} AI operations/month, unlimited
                jobs, priority AI processing, PDF &amp; DOCX export, and cover letter generation.
              </p>
              <Button asChild>
                <Link href="/dashboard/checkout">
                  <Zap className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Button>
            </div>
          )}

          {/* ── PRO cancelled: Re-subscribe card ── */}
          {isPro && isCancelled && (
            <div className="border-border bg-card space-y-4 rounded-lg border p-5">
              <div className="flex items-center gap-2">
                <CircleCheck className="text-primary h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">Renew your Pro plan</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Your subscription has been cancelled. Re-subscribe to keep your Pro benefits after
                your current period ends.
              </p>
              <Button asChild>
                <Link href="/dashboard/checkout">
                  <Zap className="h-4 w-4" />
                  Re-subscribe to Pro
                </Link>
              </Button>
            </div>
          )}

          {/* ── PRO: Payment history ── */}
          {isPro && (
            <div className="border-border bg-card space-y-4 rounded-lg border p-5">
              <h3 className="text-foreground text-sm font-semibold">Payment History</h3>
              {loadingTxns && transactions.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <PaymentsTable
                  items={transactions}
                  hasMore={hasMore}
                  loading={loadingTxns}
                  onLoadMore={() => loadTransactions(nextCursor)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
