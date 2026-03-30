"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { CheckCircle, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionData {
  plan_slug: string;
  status: string;
  current_period_end?: string;
}

type PageStatus = "polling" | "confirmed" | "timeout";

// ── Success content (reads searchParams) ──────────────────────────────────

function SuccessContent() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get("txn");

  const [status, setStatus] = useState<PageStatus>("polling");
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 15;
    let cancelled = false;

    const checkSubscription = async () => {
      if (cancelled) return;

      attempts++;
      try {
        const res = await api.get("/api/v1/subscriptions/current");
        if (res.ok) {
          const data: SubscriptionData = await res.json();
          if (data.plan_slug === "pro" && data.status === "active") {
            if (!cancelled) {
              setSubscriptionData(data);
              setStatus("confirmed");
            }
            return;
          }
        }
      } catch {
        /* ignore network errors — keep polling */
      }

      if (cancelled) return;

      if (attempts >= MAX_ATTEMPTS) {
        setStatus("timeout");
        return;
      }

      setTimeout(checkSubscription, 2000);
    };

    checkSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Polling state ─────────────────────────────────────────────────────

  if (status === "polling") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Processing your payment&hellip;</p>
        </div>
      </div>
    );
  }

  // ── Shared animated checkmark ─────────────────────────────────────────

  const AnimatedCheck = () => (
    <>
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
      <div className="flex justify-center mb-6">
        <div
          className="rounded-full bg-primary/10 p-6"
          style={{ animation: "scale-in 0.5s ease-out forwards" }}
        >
          <CheckCircle className="h-16 w-16 text-primary" />
        </div>
      </div>
    </>
  );

  // ── Timeout state ─────────────────────────────────────────────────────

  if (status === "timeout") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <AnimatedCheck />

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Payment Received!
            </h1>
            <p className="text-muted-foreground">
              Your Pro features may take a moment to activate.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmed state ───────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <AnimatedCheck />

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payment Successful!
          </h1>
          <p className="text-muted-foreground">Welcome to Light Role Pro!</p>
        </div>

        {/* Transaction details */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm text-left">
          {txnId && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-mono text-xs text-foreground break-all">{txnId}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium text-foreground">Pro</span>
          </div>
          {subscriptionData?.current_period_end && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next billing</span>
              <span className="font-medium text-foreground">
                {new Date(subscriptionData.current_period_end).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/billing">View Subscription</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          A confirmation email will be sent to your inbox.
        </p>
      </div>
    </div>
  );
}

// ── Page export (wraps in Suspense for useSearchParams) ───────────────────

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
