"use client";

import { Button } from "@/components/ui/button";
import { usePlans } from "@/hooks/api/usePlans";
import { usePricePreview } from "@/hooks/usePricePreview";
import { cn } from "@/lib/utils";
import { Globe, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillingCycleToggle } from "./BillingCycleToggle";
import { FaqAccordion, type FaqItem } from "./FaqAccordion";
import { PricingCard, type PricingFeature } from "./PricingCard";
import { type TrustItem } from "./TrustSection";

// ── Static data ──────────────────────────────────────────────────────────────

const FREE_FEATURES: PricingFeature[] = [
  { label: "10 AI operations per month", included: true },
  { label: "Up to 10 active jobs", included: true },
  { label: "AI-tailored resumes (limited)", included: true },
  { label: "AI-generated cover letters (limited)", included: true },
  { label: "Smart job description parsing (limited)", included: true },
  { label: "Basic resume template only", included: true },
  // { label: "Analytics dashboard", included: false },
  // { label: "Priority AI generation", included: false },
  // { label: "Cancel anytime — no questions asked", included: true },
];

const PRO_FEATURES: PricingFeature[] = [
  { label: "150 AI operations per month", included: true },
  { label: "Unlimited active jobs", included: true },
  { label: "AI-tailored resumes for every application", included: true },
  { label: "AI-generated cover letters with multiple variants", included: true },
  { label: "Smart job description parsing — paste and go", included: true },
  // { label: "All resume templates unlocked", included: true },
  // { label: "Analytics dashboard to track your progress", included: true },
  { label: "Priority AI generation", included: true },
  { label: "Cancel anytime — no questions asked", included: true },
];

const TRUST_ITEMS: TrustItem[] = [
  {
    icon: ShieldCheck,
    title: "Cancel anytime",
    description:
      "No lock-in contracts. Cancel your subscription instantly from your dashboard, no questions asked.",
  },
  {
    icon: RefreshCw,
    title: "Limits reset monthly",
    description:
      "Your AI operation allowance refreshes every billing cycle so you always have capacity when you need it.",
  },
  {
    icon: Globe,
    title: "Works everywhere",
    description:
      "Light Role supports multiple languages and currencies so your job search has no borders.",
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription at any time from the billing settings page. Your Pro access continues until the end of the current billing period.",
  },
  {
    q: "What is the difference between Free and Pro?",
    a: "The Free plan gives you 10 AI operations per month and up to 10 active jobs. Pro unlocks 150 AI operations, unlimited active jobs, all resume templates, analytics, and priority AI processing.",
  },
  {
    q: "How is payment processed?",
    a: "Payments are securely handled by Paddle, a trusted Merchant of Record. Your card details are never stored on our servers.",
  },
  {
    q: "Can I switch between monthly and annual?",
    a: "Yes. You can switch billing cycles from the billing settings page at any time. Changes take effect at the start of your next billing period.",
  },
  {
    q: "Is there a refund policy?",
    a: "We offer a 14-day money-back guarantee on annual plans. For monthly plans, you may cancel before the next renewal to avoid being charged again.",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function UpgradePage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  const { data: plans, isLoading: plansLoading, isError: plansError, refetch } = usePlans();

  const proPlan = plans?.find((p) => p.slug === "pro");

  const {
    monthly: monthlyPrice,
    annual: annualPrice,
    savingsPercent,
    isLoading: priceLoading,
    isError: priceError,
  } = usePricePreview({
    monthlyPriceId: proPlan?.paddle_price_id_monthly ?? null,
    annualPriceId: proPlan?.paddle_price_id_annual ?? null,
    fallbackMonthlyCents: proPlan?.price_monthly_cents,
    fallbackAnnualCents: proPlan?.price_annual_cents,
  });

  const cardLoading = plansLoading || priceLoading;

  function handleCheckout(priceId: string | null | undefined) {
    if (!priceId) return;
    router.push(`/dashboard/checkout/${priceId}`);
  }

  // ── Annual per-month equivalent ─────────────────────────────────────────
  const annualMonthlyEquivalent =
    annualPrice.raw > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(annualPrice.raw / 12 / 100)
      : null;

  // ── Error state ─────────────────────────────────────────────────────────
  if (plansError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          Could not load plans. Please try again.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center gap-3 pt-10 text-center">
        <h1 className="text-foreground max-w-2xl text-4xl leading-tight font-extrabold md:text-4xl">
          Unlock the full power of your job search
        </h1>
        <p className="text-muted-foreground max-w-xl text-base">
          Tailor every resume, generate every cover letter, and track unlimited opportunities — all
          in one place.
        </p>
      </section>

      {/* ── Billing toggle ── */}
      <BillingCycleToggle
        value={billingCycle}
        onChange={setBillingCycle}
        monthlyLabel="Monthly"
        annualLabel="Annual"
        savingsBadgeLabel={savingsPercent > 0 ? `Save ${savingsPercent}%` : undefined}
      />

      {/* ── Pricing cards ── */}
      {cardLoading ? (
        <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <PricingCard
            loading
            title=""
            description=""
            formattedPrice=""
            billingCycleLabel=""
            features={[]}
            highlighted={false}
          />
          <PricingCard
            loading
            title=""
            description=""
            formattedPrice=""
            billingCycleLabel=""
            features={[]}
            highlighted={false}
          />
        </div>
      ) : (
        <div className="grid w-full max-w-3xl grid-cols-1 items-stretch gap-6 pt-3 md:grid-cols-2">
          {priceError && (
            <p className="text-muted-foreground col-span-full w-full text-center text-xs">
              Showing default prices. Local currency unavailable.
            </p>
          )}

          {/* Free card */}
          <PricingCard
            title="Free"
            description="Your current plan"
            formattedPrice="$0"
            billingCycleLabel="Forever free"
            features={FREE_FEATURES}
            highlighted={false}
            currentPlanBadge={true}
          />

          {/* Pro card */}
          <PricingCard
            title="Pro"
            description={
              billingCycle === "annual"
                ? "Best value. Pay once, save big."
                : "Flexible month-to-month. Cancel anytime."
            }
            formattedPrice={
              billingCycle === "annual" ? annualPrice.formatted : monthlyPrice.formatted
            }
            billingCycleLabel={billingCycle === "annual" ? "Billed annually" : "Billed monthly"}
            monthlyEquivalent={
              billingCycle === "annual" && annualMonthlyEquivalent
                ? ` ${annualMonthlyEquivalent} / month`
                : undefined
            }
            savingsBadge={
              billingCycle === "annual" && savingsPercent > 0
                ? `Save ${savingsPercent}%`
                : undefined
            }
            features={PRO_FEATURES}
            highlighted={true}
            cta={
              <Button
                className={cn(
                  "w-full py-1.5 text-sm font-medium transition-all duration-300",
                  "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() =>
                  handleCheckout(
                    billingCycle === "annual"
                      ? proPlan?.paddle_price_id_annual
                      : proPlan?.paddle_price_id_monthly
                  )
                }
                // disabled={!!proPlan}
              >
                Get Started
              </Button>
            }
          />
        </div>
      )}

      {/* ── Trust section ── */}
      {/* <div className="w-full max-w-3xl">
        <TrustSection title="Why job seekers choose Pro" items={TRUST_ITEMS} />
      </div> */}

      {/* ── FAQ ── */}
      <div className="w-full max-w-3xl">
        <FaqAccordion title="Frequently asked questions" items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
