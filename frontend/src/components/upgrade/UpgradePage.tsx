"use client";

import { Button } from "@/components/ui/button";
import { type Plan, usePlans } from "@/hooks/api/usePlans";
import { usePlan } from "@/hooks/use-plan";
import { usePricePreview } from "@/hooks/usePricePreview";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BillingCycleToggle } from "./BillingCycleToggle";
import { FaqAccordion, type FaqItem } from "./FaqAccordion";
import { PricingCard, type PricingFeature } from "./PricingCard";

// ── Helpers ──────────────────────────────────────────────────────────────────
// `buildFeatures` / `planDescription` / `planTitle` were previously module-level
// helpers; they consumed hardcoded English copy. They now live as closures
// inside the component body so they can call `useTranslations`. See below.

function planTitle(plan: Plan): string {
  // Use the API name (capitalized human label).
  return plan.name;
}

// Resolve the Paddle price ID for a given plan + cycle. Prefers the value
// stored in the DB (set by the backend env at migration time); falls back to
// the public frontend env vars so the checkout flow keeps working when only
// the frontend half is configured. Returns null only when both are missing.
function resolvePriceId(plan: Plan, billingCycle: "monthly" | "annual"): string | null {
  const fromDb =
    billingCycle === "annual" ? plan.paddle_price_id_annual : plan.paddle_price_id_monthly;
  if (fromDb) return fromDb;

  if (plan.code === "pro") {
    return (
      (billingCycle === "annual"
        ? process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_ANNUAL
        : process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY) ?? null
    );
  }
  if (plan.code === "unlimited") {
    return (
      (billingCycle === "annual"
        ? process.env.NEXT_PUBLIC_PADDLE_PRICE_UNLIMITED_ANNUAL
        : process.env.NEXT_PUBLIC_PADDLE_PRICE_UNLIMITED_MONTHLY) ?? null
    );
  }
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function UpgradePage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const tHero = useTranslations("upgrade.hero");
  const tToggle = useTranslations("upgrade.toggle");
  const tErrors = useTranslations("upgrade.errors");
  const tCards = useTranslations("upgrade.cards");
  const tFeatures = useTranslations("upgrade.features");
  const tFaq = useTranslations("upgrade.faq");

  const { data: plans, isLoading: plansLoading, isError: plansError, refetch } = usePlans();
  const { plan: currentPlanCode } = usePlan();

  // FAQ items resolved from the upgrade.faq.* namespace.
  const FAQ_ITEMS: FaqItem[] = [
    { q: tFaq("items.cancel.q"), a: tFaq("items.cancel.a") },
    { q: tFaq("items.difference.q"), a: tFaq("items.difference.a") },
    { q: tFaq("items.payment.q"), a: tFaq("items.payment.a") },
    { q: tFaq("items.switch.q"), a: tFaq("items.switch.a") },
    { q: tFaq("items.refund.q"), a: tFaq("items.refund.a") },
  ];

  // Feature labels for a given plan. Replaces the module-level helper that used
  // hardcoded English copy.
  function buildFeatures(plan: Plan): PricingFeature[] {
    const jobsLabel =
      plan.max_active_jobs === null
        ? tFeatures("unlimitedJobs")
        : tFeatures("jobsLimited", { count: plan.max_active_jobs });

    const resumeLabel =
      plan.resume_credits_per_cycle === null
        ? tFeatures("unlimitedResumes")
        : tFeatures("resumesLimited", { count: plan.resume_credits_per_cycle });

    const clLabel =
      plan.cl_credits_per_cycle === null
        ? tFeatures("unlimitedCoverLetters")
        : tFeatures("coverLettersLimited", { count: plan.cl_credits_per_cycle });

    const features: PricingFeature[] = [
      { label: jobsLabel, included: true },
      { label: resumeLabel, included: true },
      { label: clLabel, included: true },
      { label: tFeatures("analytics"), included: plan.analytics_enabled },
      { label: tFeatures("priorityAi"), included: true },
    ];
    if (plan.code !== "free") {
      features.push({ label: tFeatures("support"), included: true });
    }
    return features;
  }

  function planDescription(plan: Plan, cycle: "monthly" | "annual"): string {
    if (plan.code === "free") return tCards("free.description");
    if (plan.code === "unlimited") {
      return tCards("unlimited.description");
    }
    return cycle === "annual"
      ? tCards("annual.description")
      : tCards("monthly.description");
  }

  // Sort by display_order so cards render Free → Pro → Unlimited.
  const sortedPlans = (plans ?? []).slice().sort((a, b) => a.display_order - b.display_order);

  const proPlan = sortedPlans.find((p) => p.code === "pro");
  const unlimitedPlan = sortedPlans.find((p) => p.code === "unlimited");

  // We instantiate `usePricePreview` once per paid plan. Each call has its
  // own Paddle PricePreview round-trip keyed on (monthlyPriceId, annualPriceId).
  // Refactoring the hook to accept N price-id pairs would have been a deeper
  // change with no caller benefit (only 2 paid plans today). Two parallel
  // hook calls keeps each card's loading/error state isolated.
  const proPreview = usePricePreview({
    monthlyPriceId: proPlan?.paddle_price_id_monthly ?? null,
    annualPriceId: proPlan?.paddle_price_id_annual ?? null,
    fallbackMonthlyCents: proPlan?.price_monthly_cents,
    fallbackAnnualCents: proPlan?.price_annual_cents,
  });

  const unlimitedPreview = usePricePreview({
    monthlyPriceId: unlimitedPlan?.paddle_price_id_monthly ?? null,
    annualPriceId: unlimitedPlan?.paddle_price_id_annual ?? null,
    fallbackMonthlyCents: unlimitedPlan?.price_monthly_cents,
    fallbackAnnualCents: unlimitedPlan?.price_annual_cents,
  });

  const cardLoading = plansLoading || proPreview.isLoading || unlimitedPreview.isLoading;
  const anyPriceError = proPreview.isError || unlimitedPreview.isError;

  // Annual savings shown on the toggle (uses Pro as the canonical reference,
  // matching pre-refactor behaviour).
  const toggleSavingsPercent = proPreview.savingsPercent;

  function handleCheckout(priceId: string | null | undefined) {
    if (!priceId) return;
    router.push(`/dashboard/checkout/${priceId}`);
  }

  function goToSubscription() {
    router.push("/dashboard/subscription");
  }

  // Format an annual cents total as a per-month equivalent string.
  function annualMonthlyEquivalent(annualRaw: number): string | null {
    if (annualRaw <= 0) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(annualRaw / 12 / 100);
  }

  // ── Render a single plan card ──────────────────────────────────────────
  function renderPlanCard(plan: Plan) {
    const isCurrent = currentPlanCode === plan.code;
    const isFreeCard = plan.code === "free";
    const features = buildFeatures(plan);
    const title = planTitle(plan);
    const description = planDescription(plan, billingCycle);

    // Pricing values per card.
    let formattedPrice = tCards("free.price");
    let billingCycleLabel = tCards("free.billedAs");
    let monthlyEquivalent: string | undefined;
    let savingsBadge: string | undefined;
    let preview: ReturnType<typeof usePricePreview> | null = null;

    if (plan.code === "pro") preview = proPreview;
    else if (plan.code === "unlimited") preview = unlimitedPreview;

    if (preview) {
      const { monthly, annual, savingsPercent } = preview;
      formattedPrice = billingCycle === "annual" ? annual.formatted : monthly.formatted;
      billingCycleLabel = billingCycle === "annual" ? tCards("annual.billedAs") : tCards("monthly.billedAs");
      if (billingCycle === "annual") {
        const eq = annualMonthlyEquivalent(annual.raw);
        if (eq) monthlyEquivalent = tCards("annual.monthlyEquivalent", { price: eq });
        if (savingsPercent > 0) savingsBadge = tCards("annual.savingsBadge", { percent: savingsPercent });
      }
    }

    // ── CTA logic ───────────────────────────────────────────────────────
    let cta: React.ReactNode | undefined;

    if (isCurrent) {
      // The "Current plan" badge already conveys state — render a disabled
      // outlined button so card heights line up with neighbours.
      cta = (
        <Button variant="outline" className="w-full py-1.5 text-sm font-medium" disabled>
          {tCards("free.currentPlanBadge")}
        </Button>
      );
    } else if (isFreeCard) {
      // User is on a paid plan and looking at Free → this is a downgrade.
      // The cancel/downgrade flow lives on /dashboard/subscription
      // (MONETIZE-12). Backend rejects change-plan with plan_code=free.
      cta = (
        <Button
          variant="outline"
          className="w-full py-1.5 text-sm font-medium"
          onClick={goToSubscription}
        >
          {tCards("downgradeToFree")}
        </Button>
      );
    } else {
      // Paid target plan. Compare display_order to current plan's order to
      // decide upgrade vs downgrade copy/route.
      const currentPlan = sortedPlans.find((p) => p.code === currentPlanCode);
      const isDowngrade =
        currentPlan != null && currentPlan.display_order > plan.display_order;

      const priceId = resolvePriceId(plan, billingCycle);
      const priceIdMissing = !priceId;

      if (isDowngrade) {
        // Downgrade between paid tiers — defer to /dashboard/subscription
        // for the confirmation flow (MONETIZE-12).
        cta = (
          <Button
            variant="outline"
            className="w-full py-1.5 text-sm font-medium"
            onClick={goToSubscription}
          >
            {tCards("downgradeTo", { title })}
          </Button>
        );
      } else {
        // Upgrade (or first-time purchase from Free).
        const label =
          currentPlanCode && currentPlanCode !== "free"
            ? tCards("upgradeTo", { title })
            : tCards("monthly.cta");
        cta = (
          <Button
            className={cn(
              "w-full py-1.5 text-sm font-medium transition-all duration-300",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={() => handleCheckout(priceId)}
            disabled={priceIdMissing}
          >
            {label}
          </Button>
        );
      }
    }

    const featured =
      plan.code === "pro" ? "primary" : plan.code === "unlimited" ? "unlimited" : undefined;
    const featuredBadge =
      plan.code === "unlimited"
        ? { label: "Best Deal", tone: "unlimited" as const }
        : undefined;

    return (
      <PricingCard
        key={plan.id}
        title={title}
        description={description}
        formattedPrice={formattedPrice}
        billingCycleLabel={billingCycleLabel}
        monthlyEquivalent={monthlyEquivalent}
        savingsBadge={savingsBadge}
        features={features}
        featured={featured}
        featuredBadge={featuredBadge}
        currentPlanBadge={isCurrent}
        cta={cta}
      />
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (plansError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          {tErrors("plansLoadFailed")}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          {tErrors("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center gap-3 pt-10 text-center">
        <h1 className="text-foreground max-w-2xl text-4xl leading-tight font-extrabold md:text-4xl">
          {tHero("headline")}
        </h1>
        <p className="text-muted-foreground max-w-xl text-base">
          {tHero("subheadline")}
        </p>
      </section>

      {/* ── Billing toggle ── */}
      <BillingCycleToggle
        value={billingCycle}
        onChange={setBillingCycle}
        monthlyLabel={tToggle("monthly")}
        annualLabel={tToggle("annual")}
        savingsBadgeLabel={
          toggleSavingsPercent > 0
            ? tToggle("save", { percent: toggleSavingsPercent })
            : undefined
        }
      />

      {/* ── Pricing cards ── */}
      {cardLoading ? (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <PricingCard
              key={i}
              loading
              title=""
              description=""
              formattedPrice=""
              billingCycleLabel=""
              features={[]}
            />
          ))}
        </div>
      ) : (
        <div className="grid w-full max-w-5xl grid-cols-1 items-stretch gap-6 pt-3 md:grid-cols-3">
          {anyPriceError && (
            <p className="text-muted-foreground col-span-full w-full text-center text-xs">
              {tErrors("pricesFallback")}
            </p>
          )}

          {sortedPlans.map((plan) => renderPlanCard(plan))}
        </div>
      )}

      {/* ── FAQ ── */}
      <div className="w-full max-w-5xl">
        <FaqAccordion title={tFaq("title")} items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
