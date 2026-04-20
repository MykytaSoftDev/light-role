"use client";

import { BillingToggle } from "@/components/checkout/billing-toggle";
import { Button } from "@/components/ui/button";
import { getPlans, type Plan } from "@/lib/plans-api";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ── Metadata is exported from a sibling server file; here we use the client
// component approach since we need Paddle price preview interactivity.

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function annualMonthlyCents(plan: Plan): number {
  return Math.round(plan.price_annual_cents / 12);
}

function savingsPercent(plan: Plan): number {
  if (plan.price_monthly_cents === 0) return 0;
  const annual = annualMonthlyCents(plan);
  return Math.round(((plan.price_monthly_cents - annual) / plan.price_monthly_cents) * 100);
}

// ── Default feature lists (fallback if plan has no features_json) ──────────

const FREE_FEATURES = [
  "5 AI operations / month",
  "Up to 5 active jobs",
  "Resume tailoring (basic)",
  "Job application tracking",
  "Kanban & table views",
];

const PRO_FEATURES = [
  "100 AI operations / month",
  "Unlimited active jobs",
  "Priority AI processing",
  "PDF export",
  "Cover letter generation",
  "Advanced resume tailoring",
  "Full job board integration",
];

// ── Plan card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
  name: string;
  price: string;
  pricePeriod: string;
  annualNote?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
}

function PlanCard({
  name,
  price,
  pricePeriod,
  annualNote,
  description,
  features,
  ctaLabel,
  ctaHref,
  highlighted = false,
  badge,
}: PlanCardProps) {
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-8 transition-shadow",
        highlighted
          ? "border-primary ring-1 ring-primary bg-card shadow-lg"
          : "border-border bg-card",
      ].join(" ")}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {badge}
          </span>
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-semibold text-foreground">{name}</h3>

      {/* Price */}
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        <span className="mb-1 text-sm text-muted-foreground">{pricePeriod}</span>
      </div>
      {annualNote && (
        <p className="mt-0.5 text-xs text-muted-foreground">{annualNote}</p>
      )}

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>

      {/* CTA */}
      <div className="mt-6">
        <Button
          asChild
          className="w-full"
          variant={highlighted ? "default" : "outline"}
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>

      {/* Divider */}
      <div className="my-6 border-t border-border" />

      {/* Features */}
      <ul className="flex flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <CheckCircle
              className={[
                "mt-0.5 h-4 w-4 flex-shrink-0",
                highlighted ? "text-primary" : "text-muted-foreground",
              ].join(" ")}
            />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch(() => {
        // Silently fall back to hardcoded display values
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Derive per-plan display data
  const freePlan = plans.find((p) => p.slug === "free");
  const proPlan = plans.find((p) => p.slug === "pro");

  const proSavings = proPlan ? savingsPercent(proPlan) : 25;

  const freePrice = "$0.00";
  const proPrice = proPlan
    ? cycle === "annual"
      ? formatCents(annualMonthlyCents(proPlan))
      : formatCents(proPlan.price_monthly_cents)
    : cycle === "annual"
      ? "$7.50"
      : "$9.99";

  const proAnnualNote =
    cycle === "annual" && proPlan
      ? `Billed ${formatCents(proPlan.price_annual_cents)} annually`
      : cycle === "annual"
        ? "Billed $90.00 annually"
        : undefined;

  const freeFeatures =
    freePlan?.features_json?.length ? freePlan.features_json : FREE_FEATURES;
  const proFeatures =
    proPlan?.features_json?.length ? proPlan.features_json : PRO_FEATURES;

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted-foreground">
          Start free and upgrade when you need more. No hidden fees, no surprises.
        </p>

        {/* Billing toggle */}
        <div className="flex justify-center pt-2">
          <BillingToggle
            value={cycle}
            onChange={setCycle}
            savingsPercent={proSavings > 0 ? proSavings : undefined}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {/* Free */}
        <PlanCard
          name="Free"
          price={freePrice}
          pricePeriod="/mo"
          description={
            freePlan?.description ??
            "Everything you need to start your job search."
          }
          features={freeFeatures}
          ctaLabel="Get Started Free"
          ctaHref="/auth/register"
        />

        {/* Pro */}
        <PlanCard
          name="Pro"
          price={isLoading ? "—" : proPrice}
          pricePeriod="/mo"
          annualNote={proAnnualNote}
          description={
            proPlan?.description ??
            "For serious job seekers who want the full AI-powered toolkit."
          }
          features={proFeatures}
          ctaLabel="Get Started with Pro"
          ctaHref={`/dashboard/checkout?plan=pro&cycle=${cycle}`}
          highlighted
          badge="Most Popular"
        />
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        All prices in USD. Taxes may apply based on your location. Payments
        processed securely by{" "}
        <a
          href="https://paddle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Paddle
        </a>
        .
      </p>
    </main>
  );
}
