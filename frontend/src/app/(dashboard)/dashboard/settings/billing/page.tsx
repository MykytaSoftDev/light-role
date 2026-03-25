"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { initPaddle, openCheckout } from "@/lib/paddle";
import { getSubscription, type SubscriptionDetail } from "@/lib/subscription-api";
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
import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface CurrentUser {
  id: string;
  email: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
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

// ── Usage bar ──────────────────────────────────────────────────────────────

interface UsageBarProps {
  label: string;
  used: number;
  /** null = unlimited */
  limit: number | null;
  unit?: string;
}

function UsageBar({ label, used, limit, unit = "" }: UsageBarProps) {
  if (limit === null) {
    // Unlimited — show a full green bar with an infinity indicator
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground font-medium">{label}</span>
          <span className="text-muted-foreground flex items-center gap-1">
            {used}
            {unit && ` ${unit}`}
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
          {unit && ` ${unit}`}
        </span>
      </div>
      <Progress
        value={pct}
        className={
          isCritical ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-amber-500" : undefined
        }
      />
    </div>
  );
}

// ── Pricing card ───────────────────────────────────────────────────────────

interface PricingCardProps {
  label: string;
  price: string;
  period: string;
  badge?: string;
  features: string[];
  loading: boolean;
  onUpgrade: () => void;
}

function PricingCard({
  label,
  price,
  period,
  badge,
  features,
  loading,
  onUpgrade,
}: PricingCardProps) {
  return (
    <div className="border-border bg-card relative flex flex-col space-y-4 rounded-lg border p-5">
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs">{badge}</Badge>
        </div>
      )}
      <div>
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-foreground text-3xl font-bold">{price}</span>
          <span className="text-muted-foreground text-sm">/{period}</span>
        </div>
      </div>
      <ul className="text-muted-foreground flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CircleCheck className="text-primary h-4 w-4 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={onUpgrade} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening checkout...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Upgrade to Pro
          </>
        )}
      </Button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual" | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PRICE_MONTHLY = process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY ?? "";
  const PRICE_ANNUAL = process.env.NEXT_PUBLIC_PADDLE_PRICE_ANNUAL ?? "";

  // ── Load subscription + user ─────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [subData, userRes] = await Promise.all([
          getSubscription(),
          api.get("/api/v1/users/me"),
        ]);

        setSub(subData);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser({ id: userData.id, email: userData.email });
        }
      } catch {
        setLoadError("Unable to load your billing information. Please try again.");
      }
    }

    load();
  }, []);

  // ── Initialize Paddle ────────────────────────────────────────────────────

  useEffect(() => {
    initPaddle();
  }, []);

  // ── Cleanup timer ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  // ── Checkout handler ─────────────────────────────────────────────────────

  function handleUpgrade(plan: "monthly" | "annual") {
    if (!user) return;
    const priceId = plan === "monthly" ? PRICE_MONTHLY : PRICE_ANNUAL;
    console.log("token:", process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
    console.log("env:", process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT);
    console.log("env:", process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY);
    console.log("env:", process.env.NEXT_PUBLIC_PADDLE_PRICE_ANNUAL);
    console.log(priceId);
    if (!priceId) {
      setLoadError("Checkout is not available right now. Please try again later.");
      return;
    }

    setCheckoutLoading(plan);

    openCheckout(priceId, user.email, user.id, () => {
      setCheckoutLoading(null);
      setUpgradeMessage("Processing your upgrade... Your plan will be updated shortly.");
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => setUpgradeMessage(null), 8000);
    });

    // Reset button state after a brief delay in case the user closes the overlay
    setTimeout(() => setCheckoutLoading(null), 2000);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  // Use effective_plan (falls back to raw plan) so that a cancelled Pro user
  // whose subscription hasn't expired yet still sees the Pro view.
  const isPro = (sub?.effective_plan ?? sub?.plan) === "pro";
  const isCancelled = sub?.status === "cancelled";
  const isPastDue = sub?.status === "past_due";

  const PRO_FEATURES = [
    "100 AI operations per month",
    "Unlimited active jobs",
    "Priority AI processing",
    "PDF & DOCX export",
    "Cover letter generation",
  ];

  // ── Render ───────────────────────────────────────────────────────────────

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

      {/* Upgrade success message */}
      {upgradeMessage && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
          <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{upgradeMessage}</span>
        </div>
      )}

      {/* Past due warning */}
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
              asChild
            >
              <a href="https://customer.paddle.com" target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4" />
                Update Payment Method
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!sub && !loadError && (
        <div className="space-y-6">
          <div className="border-border space-y-4 rounded-lg border p-5">
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted h-6 w-20 animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                    <div className="bg-muted h-4 w-16 animate-pulse rounded" />
                  </div>
                  <div className="bg-muted h-2 w-full animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted h-52 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Content — loaded */}
      {sub && (
        <div className="space-y-6">
          {/* ── Current plan card ── */}
          <div className="border-border bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold">Current Plan</h3>
              </div>
              {isPro ? (
                <Badge className="bg-primary text-primary-foreground">Pro</Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </div>

            {/* Cancelled notice */}
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

            {/* Pro billing info */}
            {isPro && !isCancelled && (
              <div className="text-muted-foreground space-y-0.5 text-sm">
                {sub.current_period_start && (
                  <p>
                    Billing period:{" "}
                    <span className="text-foreground">{formatDate(sub.current_period_start)}</span>{" "}
                    — <span className="text-foreground">{formatDate(sub.current_period_end)}</span>
                  </p>
                )}
                {sub.current_period_end && (
                  <p>
                    Next renewal:{" "}
                    <span className="text-foreground">{formatDate(sub.current_period_end)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Free plan reset date */}
            {!isPro && sub.reset_date && (
              <p className="text-muted-foreground text-sm">
                Usage resets: <span className="text-foreground">{formatDate(sub.reset_date)}</span>
              </p>
            )}

            {/* Usage bars — use effective_limits to correctly show unlimited for Pro */}
            <div className="space-y-4 pt-1">
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

            {/* Pro manage subscription */}
            {isPro && (
              <div className="border-border border-t pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://customer.paddle.com" target="_blank" rel="noopener noreferrer">
                    <CreditCard className="h-4 w-4" />
                    Manage Subscription
                  </a>
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  Manage your payment method, invoices, and cancellation via the Paddle customer
                  portal.
                </p>
              </div>
            )}
          </div>

          {/* ── Upgrade section (free users only) ── */}
          {!isPro && (
            <div className="space-y-4">
              <div>
                <h3 className="text-foreground text-sm font-semibold">Upgrade to Pro</h3>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Unlock more AI operations, unlimited jobs, and priority processing.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PricingCard
                  label="Pro Monthly"
                  price="$9"
                  period="mo"
                  features={PRO_FEATURES}
                  loading={checkoutLoading === "monthly"}
                  onUpgrade={() => handleUpgrade("monthly")}
                />
                <PricingCard
                  label="Pro Annual"
                  price="$69"
                  period="year"
                  badge="Best Value — Save 36%"
                  features={PRO_FEATURES}
                  loading={checkoutLoading === "annual"}
                  onUpgrade={() => handleUpgrade("annual")}
                />
              </div>

              <p className="text-muted-foreground text-xs">
                Payments are processed securely by Paddle. You can cancel at any time.
              </p>
            </div>
          )}

          {/* ── Re-subscribe section (cancelled pro users) ── */}
          {isPro && isCancelled && (
            <div className="space-y-4">
              <div>
                <h3 className="text-foreground text-sm font-semibold">Renew your Pro plan</h3>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Your subscription has been cancelled. Re-subscribe to keep your Pro benefits.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PricingCard
                  label="Pro Monthly"
                  price="$9"
                  period="mo"
                  features={PRO_FEATURES}
                  loading={checkoutLoading === "monthly"}
                  onUpgrade={() => handleUpgrade("monthly")}
                />
                <PricingCard
                  label="Pro Annual"
                  price="$69"
                  period="year"
                  badge="Best Value — Save 36%"
                  features={PRO_FEATURES}
                  loading={checkoutLoading === "annual"}
                  onUpgrade={() => handleUpgrade("annual")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
