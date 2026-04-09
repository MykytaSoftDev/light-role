"use client";

import { Button } from "@/components/ui/button";
import { usePlans } from "@/hooks/api/usePlans";
import { usePricePreview } from "@/hooks/usePricePreview";
import { Globe, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillingCycleToggle } from "./BillingCycleToggle";
import { type ComparisonRow } from "./ComparisonTable";
import { type FaqItem } from "./FaqAccordion";
import { PricingCard } from "./PricingCard";
import { type TrustItem } from "./TrustSection";

// ── Static data ──────────────────────────────────────────────────────────────

const FEATURES: string[] = [
  "150 AI operations per month (vs 10 on Free)",
  "Unlimited active jobs in your tracker",
  "AI-tailored resumes for every application",
  "AI-generated cover letters with multiple variants",
  "Smart job description parsing — paste and go",
  "All resume templates unlocked",
  "Analytics dashboard to track your progress",
  "Priority AI generation",
  "Cancel anytime — no questions asked",
];

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Active jobs", free: "5", pro: "Unlimited" },
  { feature: "AI operations / month", free: "10", pro: "150" },
  { feature: "Resume templates", free: "1", pro: "All templates" },
  { feature: "Resume tailoring", free: "Yes", pro: "Yes" },
  { feature: "Cover letter generation", free: "Yes", pro: "Yes" },
  { feature: "AI job parsing", free: "Yes", pro: "Yes" },
  { feature: "Analytics dashboard", free: "—", pro: "Yes" },
  { feature: "Priority AI processing", free: "—", pro: "Yes" },
  { feature: "PDF & DOCX export", free: "Yes", pro: "Yes" },
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
    a: "The Free plan gives you 10 AI operations per month and up to 5 active jobs. Pro unlocks 150 AI operations, unlimited active jobs, all resume templates, analytics, and priority AI processing.",
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
    <div className="flex flex-col items-center gap-16 pb-24">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center gap-3 pt-10 text-center">
        {/* <span className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Upgrade to Pro
        </span> */}
        <h1 className="text-foreground max-w-2xl text-4xl leading-tight font-extrabold md:text-4xl">
          Unlock the full power of your job search
        </h1>
        <p className="text-muted-foreground max-w-xl text-base">
          Tailor every resume, generate every cover letter, and track unlimited opportunities — all
          in one place.
        </p>
        {/*<p className="text-muted-foreground text-xs">Cancel anytime · Secure payment via Paddle</p> */}
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
        <div className="flex w-full max-w-3xl flex-col gap-6 md:flex-row">
          <PricingCard
            loading
            title=""
            description=""
            formattedPrice=""
            billingCycleLabel=""
            features={[]}
            ctaLabel=""
            onCtaClick={() => {}}
            highlighted={false}
          />
          <PricingCard
            loading
            title=""
            description=""
            formattedPrice=""
            billingCycleLabel=""
            features={[]}
            ctaLabel=""
            onCtaClick={() => {}}
            highlighted={false}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col gap-6 pt-3 md:flex-row md:items-start">
          {priceError && (
            <p className="text-muted-foreground w-full text-center text-xs">
              Showing default prices. Local currency unavailable.
            </p>
          )}

          {/* Monthly card */}
          <PricingCard
            title="Pro Monthly"
            description="Flexible month-to-month. Cancel anytime."
            formattedPrice={monthlyPrice.formatted}
            billingCycleLabel="Billed monthly"
            features={FEATURES}
            ctaLabel="Get Pro Monthly"
            onCtaClick={() => handleCheckout(proPlan?.paddle_price_id_monthly)}
            highlighted={billingCycle === "monthly"}
          />

          {/* Annual card */}
          <PricingCard
            title="Pro Annual"
            description="Best value. Pay once, save big."
            formattedPrice={annualPrice.formatted}
            billingCycleLabel="Billed annually"
            // monthlyEquivalent={
            //   annualMonthlyEquivalent ? `≈ ${annualMonthlyEquivalent} / month` : undefined
            // }
            savingsBadge={savingsPercent > 0 ? `Save ${savingsPercent}%` : undefined}
            features={FEATURES}
            ctaLabel="Get Pro Annual"
            onCtaClick={() => handleCheckout(proPlan?.paddle_price_id_annual)}
            highlighted={billingCycle === "annual"}
          />
        </div>
      )}

      {/* ── Comparison table ── */}
      {/* <div className="w-full max-w-3xl">
        <ComparisonTable
          title="Free vs Pro at a glance"
          colFeature="Feature"
          colFree="Free"
          colPro="Pro"
          rows={COMPARISON_ROWS}
        />
      </div> */}

      {/* ── Trust section ── */}
      {/* <div className="w-full max-w-3xl">
        <TrustSection title="Why job seekers choose Pro" items={TRUST_ITEMS} />
      </div> */}

      {/* ── FAQ ── */}
      {/* <div className="w-full max-w-3xl">
        <FaqAccordion title="Frequently asked questions" items={FAQ_ITEMS} />
      </div> */}

      {/* ── Footer CTA ── */}
      {/* <section className="flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
        <h2 className="text-foreground text-2xl font-bold">
          Ready to land your next role faster?
        </h2>
        <Button
          size="lg"
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold px-8"
          onClick={() =>
            handleCheckout(
              billingCycle === "annual"
                ? proPlan?.paddle_price_id_annual
                : proPlan?.paddle_price_id_monthly
            )
          }
          disabled={cardLoading || !proPlan}
        >
          {billingCycle === "annual" ? "Get Pro Annual" : "Get Pro Monthly"}
        </Button>
        <a
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Back to dashboard
        </a>
      </section>*/}
    </div>
  );
}
