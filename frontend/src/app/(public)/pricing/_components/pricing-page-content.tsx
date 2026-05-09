"use client";

import { BillingToggle } from "@/components/checkout/billing-toggle";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/api/useUser";
import { type Plan, usePlans } from "@/hooks/api/usePlans";
import { usePlan } from "@/hooks/use-plan";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

// Build features dynamically from the v2.1 plan API shape. Mirrors the helper
// used by `UpgradePage` (MONETIZE-10) so the public pricing page and the
// in-dashboard upgrade page stay consistent.
function buildFeatures(plan: Plan): string[] {
  const jobsLabel =
    plan.max_active_jobs === null
      ? "Unlimited active jobs"
      : `Up to ${plan.max_active_jobs} active jobs`;

  const resumeLabel =
    plan.resume_credits_per_cycle === null
      ? "Unlimited resume tailorings"
      : `${plan.resume_credits_per_cycle} resume tailorings / cycle`;

  const clLabel =
    plan.cl_credits_per_cycle === null
      ? "Unlimited cover letters"
      : `${plan.cl_credits_per_cycle} cover letters / cycle`;

  const features = [
    jobsLabel,
    resumeLabel,
    clLabel,
    "Smart job description parsing",
  ];

  if (plan.analytics_enabled) features.push("Analytics dashboard");
  if (plan.code !== "free") features.push("Cancel anytime");

  return features;
}

function planCopy(plan: Plan): string {
  if (plan.code === "free") return "Everything you need to start your job search.";
  if (plan.code === "pro") return "For serious job seekers who want the full AI-powered toolkit.";
  return "Maximum power. No limits, ever.";
}

// ── Plan card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
  name: string;
  price: string;
  pricePeriod: string;
  annualNote?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  ctaDisabled?: boolean;
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
  ctaDisabled,
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
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {badge}
          </span>
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground">{name}</h3>

      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        <span className="mb-1 text-sm text-muted-foreground">{pricePeriod}</span>
      </div>
      {annualNote && (
        <p className="mt-0.5 text-xs text-muted-foreground">{annualNote}</p>
      )}

      <p className="mt-3 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">
        {ctaDisabled || !ctaHref ? (
          <Button className="w-full" variant="outline" disabled>
            {ctaLabel}
          </Button>
        ) : (
          <Button
            asChild
            className="w-full"
            variant={highlighted ? "default" : "outline"}
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        )}
      </div>

      <div className="my-6 border-t border-border" />

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

// ── Page content ───────────────────────────────────────────────────────────

export function PricingPageContent() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const { data: plans, isLoading } = usePlans();

  // Auth detection: `useUser()` queries `/api/v1/users/me`. On a public
  // visit it 401s and surfaces as `isError`. When logged-in, `data` is
  // populated. We use this rather than `useCurrentSubscription()` because
  // `useUser` is already shared with the rest of the app — the cache hit
  // is free for an authenticated visitor arriving from the dashboard.
  const { data: user, isError: userIsAnon } = useUser();
  const isLoggedIn = !!user && !userIsAnon;

  // For logged-in users we also want to know what plan they're on so the
  // CTAs can read "Current plan" / "Upgrade to X" / "Downgrade to Free".
  // `usePlan` returns `null` for anonymous users (since the underlying
  // `/subscriptions/current` 401s), which is fine — we only consult it
  // when `isLoggedIn` is true.
  const { plan: currentPlanCode } = usePlan();

  const sortedPlans = (plans ?? []).slice().sort((a, b) => a.display_order - b.display_order);

  const proPlan = sortedPlans.find((p) => p.code === "pro");
  const proSavings = proPlan ? savingsPercent(proPlan) : 0;

  function priceFor(plan: Plan): string {
    if (plan.code === "free") return "$0.00";
    return cycle === "annual"
      ? formatCents(annualMonthlyCents(plan))
      : formatCents(plan.price_monthly_cents);
  }

  function annualNoteFor(plan: Plan): string | undefined {
    if (plan.code === "free" || cycle !== "annual") return undefined;
    return `Billed ${formatCents(plan.price_annual_cents)} annually`;
  }

  // CTA logic — see brief section 2.
  function ctaFor(plan: Plan): { label: string; href?: string; disabled?: boolean } {
    if (!isLoggedIn) {
      // Anonymous → register, prefilled with the chosen plan.
      if (plan.code === "free") {
        return { label: "Get Started Free", href: "/auth/register?plan=free" };
      }
      const proper = plan.name; // "Pro" / "Unlimited"
      return { label: `Start with ${proper}`, href: `/auth/register?plan=${plan.code}` };
    }

    // Logged-in branch.
    const isCurrent = currentPlanCode === plan.code;
    if (isCurrent) {
      return { label: "Your current plan", disabled: true };
    }

    if (plan.code === "free") {
      // User is on a paid plan looking at Free → downgrade flow.
      return { label: "Downgrade", href: "/dashboard/subscription" };
    }

    // Paid target.
    return { label: `Upgrade to ${plan.name}`, href: "/dashboard/upgrade" };
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted-foreground">
          Start free and upgrade when you need more. No hidden fees, no surprises.
        </p>

        <div className="flex justify-center pt-2">
          <BillingToggle
            value={cycle}
            onChange={setCycle}
            savingsPercent={proSavings > 0 ? proSavings : undefined}
          />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {isLoading || sortedPlans.length === 0
          ? [0, 1, 2].map((i) => (
              <PlanCard
                key={i}
                name="—"
                price="—"
                pricePeriod="/mo"
                description=""
                features={[]}
                ctaLabel="Loading…"
                ctaDisabled
              />
            ))
          : sortedPlans.map((plan) => {
              const cta = ctaFor(plan);
              const highlighted = plan.code === "pro";
              const badge = plan.code === "pro" ? "Most Popular" : undefined;

              return (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  price={priceFor(plan)}
                  pricePeriod={plan.code === "free" ? "" : "/mo"}
                  annualNote={annualNoteFor(plan)}
                  description={plan.description ?? planCopy(plan)}
                  features={buildFeatures(plan)}
                  ctaLabel={cta.label}
                  ctaHref={cta.href}
                  ctaDisabled={cta.disabled}
                  highlighted={highlighted}
                  badge={badge}
                />
              );
            })}
      </div>

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
