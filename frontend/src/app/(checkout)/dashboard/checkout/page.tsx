"use client";

import { BillingToggle } from "@/components/checkout/billing-toggle";
import { usePaddle } from "@/hooks/use-paddle";
import { api } from "@/lib/api";
import { getPlans, type Plan } from "@/lib/plans-api";
import { getSubscription } from "@/lib/subscription-api";
import { CurrentUser } from "@/lib/user";
import { CheckCircle, Loader2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function annualMonthlyCents(plan: Plan): number {
  // price_annual_cents is the total annual price; derive per-month equivalent
  return Math.round(plan.price_annual_cents / 12);
}

function savingsPercent(plan: Plan): number {
  if (plan.price_monthly_cents === 0) return 0;
  const annualMonthly = annualMonthlyCents(plan);
  return Math.round(((plan.price_monthly_cents - annualMonthly) / plan.price_monthly_cents) * 100);
}

// ── Loading spinner ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex min-h-[450px] items-center justify-center">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
    </div>
  );
}

// ── Checkout inner (reads searchParams) ───────────────────────────────────

function CheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL params
  const paramPlan = searchParams.get("plan") ?? "pro";
  const paramCycle = (searchParams.get("cycle") ?? "monthly") as "monthly" | "annual";

  // State
  const [cycle, setCycle] = useState<"monthly" | "annual">(paramCycle);
  const [proPlan, setProPlan] = useState<Plan | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Paddle hook
  const { isLoaded, totals, openCheckout, updateCheckout } = usePaddle();

  // Track whether checkout was already opened so we only call openCheckout once
  const checkoutOpenedRef = useRef(false);

  // ── Load plans + user + subscription check ──────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [plans, userData, subData] = await Promise.all([
          getPlans(),
          api.get("/api/v1/users/me").then((r) => {
            if (!r.ok) throw new Error("auth");
            return r.json() as Promise<CurrentUser>;
          }),
          getSubscription(),
        ]);
        // If user is already active Pro, redirect away
        if (
          (subData.effective_plan === "pro" || subData.plan === "pro") &&
          subData.status === "active"
        ) {
          router.replace("/dashboard/settings/billing");
          return;
        }

        const found = plans.find((p) => p.slug === "pro") ?? null;
        setProPlan(found);
        setUser(userData);
      } catch (err) {
        console.log(err);
        const msg =
          err instanceof Error && err.message === "auth"
            ? "Unable to verify your session. Please sign in again."
            : "Unable to load checkout. Please refresh and try again.";
        setPageError(msg);
      } finally {
        setIsPageLoading(false);
      }
    }

    load();
  }, [router]);

  // ── Open Paddle checkout once Paddle + data are both ready ───────────────

  useEffect(() => {
    if (checkoutOpenedRef.current) return;
    if (!proPlan || !user) return;

    const priceId =
      cycle === "annual" ? proPlan.paddle_price_id_annual : proPlan.paddle_price_id_monthly;

    if (!priceId) return;

    // Paddle may still be initializing; openCheckout is a no-op until paddleRef is set
    checkoutOpenedRef.current = true;
    openCheckout(priceId, user.email, user.id, "checkout-container", "light");
  }, [proPlan, user, cycle, openCheckout]);

  // ── Handle billing cycle toggle ──────────────────────────────────────────

  function handleCycleChange(next: "monthly" | "annual") {
    setCycle(next);

    if (!proPlan) return;
    const priceId =
      next === "annual" ? proPlan.paddle_price_id_annual : proPlan.paddle_price_id_monthly;

    if (!priceId) return;

    if (isLoaded) {
      updateCheckout({ priceId });
    } else {
      // Paddle not ready yet — reopen when it becomes ready
      checkoutOpenedRef.current = false;
    }
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (pageError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground">{pageError}</p>
      </main>
    );
  }

  // ── Page loading ─────────────────────────────────────────────────────────

  if (isPageLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <LoadingSpinner />
      </main>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────

  const displayPrice = proPlan
    ? cycle === "annual"
      ? formatCents(annualMonthlyCents(proPlan))
      : formatCents(proPlan.price_monthly_cents)
    : null;

  const annualTotal = proPlan ? formatCents(proPlan.price_annual_cents) : null;

  const savings = proPlan ? savingsPercent(proPlan) : 0;

  const features: string[] = proPlan?.features_json ?? [
    "100 AI operations / month",
    "Unlimited active jobs",
    "Priority AI processing",
    "PDF & DOCX export",
    "Cover letter generation",
    "Resume tailoring",
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_3fr]">
        {/* ── Order summary ── */}
        <div className="space-y-6">
          {/* Billing toggle */}
          <div className="flex flex-col gap-1.5">
            <p className="text-foreground text-sm font-medium">Billing cycle</p>
            <BillingToggle
              value={cycle}
              onChange={handleCycleChange}
              disabled={!proPlan}
              savingsPercent={savings > 0 ? savings : undefined}
            />
          </div>

          {/* Plan card */}
          <div className="border-border bg-card space-y-4 rounded-lg border p-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary h-4 w-4" />
              <span className="text-foreground text-sm font-semibold">Light Role Pro</span>
            </div>

            {/* Price */}
            {displayPrice && (
              <div>
                <div className="flex items-end gap-1">
                  <span className="text-foreground text-3xl font-bold">{displayPrice}</span>
                  <span className="text-muted-foreground mb-1 text-sm">/mo</span>
                </div>
                {cycle === "annual" && annualTotal && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Billed {annualTotal} annually
                  </p>
                )}
              </div>
            )}

            {/* Features */}
            <ul className="space-y-2">
              {features.map((feature) => (
                <li key={feature} className="text-muted-foreground flex items-start gap-2 text-sm">
                  <CheckCircle className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Totals — shown once Paddle has loaded pricing */}
          {isLoaded && (totals.subtotal || totals.total) && (
            <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-4 text-sm">
              {totals.subtotal && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Subtotal</span>
                  <span>{totals.subtotal}</span>
                </div>
              )}
              {totals.tax && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Tax</span>
                  <span>{totals.tax}</span>
                </div>
              )}
              {totals.total && (
                <div className="text-foreground border-border flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{totals.total}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer notices */}
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>Taxes calculated at checkout based on your location.</p>
            <p>Secure payments powered by Paddle.</p>
          </div>
        </div>

        {/* ── Paddle inline frame ── */}
        <div className="relative">
          {!isLoaded && <LoadingSpinner />}
          {/* Paddle renders its iframe into this element */}
          <div id="checkout-container" className="checkout-container min-w-[312px]" />
        </div>
      </div>
    </main>
  );
}

// ── Page export (wraps in Suspense for useSearchParams) ───────────────────

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-16">
          <div className="flex min-h-[450px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </main>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
