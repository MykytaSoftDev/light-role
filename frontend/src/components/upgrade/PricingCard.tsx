"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

export interface PricingFeature {
  label: string;
  included: boolean;
}

export type FeaturedTone = "primary" | "unlimited";

export interface FeaturedBadge {
  label: string;
  tone: FeaturedTone;
}

export interface PricingCardProps {
  title: string;
  description: string;
  formattedPrice: string;
  billingCycleLabel: string;
  monthlyEquivalent?: string;
  savingsBadge?: string;
  features: PricingFeature[];
  /** Visual emphasis: "primary" (Pro), "unlimited" (amber), or unset (Free / neutral). */
  featured?: FeaturedTone;
  /** Identity badge shown next to the title. Independent of `featured` so callers
   *  can mix-and-match if needed (e.g. Pro card with "Most Popular"). */
  featuredBadge?: FeaturedBadge;
  currentPlanBadge?: boolean;
  cta?: React.ReactNode;
  loading?: boolean;
}

export function PricingCard({
  title,
  description,
  formattedPrice,
  billingCycleLabel,
  monthlyEquivalent,
  savingsBadge,
  features,
  featured,
  featuredBadge,
  currentPlanBadge = false,
  cta,
  loading = false,
}: PricingCardProps) {
  if (loading) {
    return (
      <Card className="flex h-full flex-col p-6">
        <Skeleton className="mb-2 h-6 w-32" />
        <Skeleton className="mb-6 h-4 w-48" />
        <Skeleton className="mb-1 h-10 w-24" />
        <Skeleton className="mb-6 h-3 w-20" />
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-full" />
      </Card>
    );
  }

  const cardSurfaceClass =
    featured === "primary"
      ? "pricing-card-gradient-featured ring-primary/50 ring-1"
      : featured === "unlimited"
        ? "pricing-card-gradient-unlimited ring-amber-500/50 ring-1"
        : "pricing-card-gradient";

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col transition-all duration-200",
        cardSurfaceClass
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-foreground text-lg font-bold">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>

          {/* Right column stacks the identity + savings badges so cards align
              even when only one is present. */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {currentPlanBadge && (
              <Badge variant="secondary" className="text-xs">
                Current plan
              </Badge>
            )}

            {featuredBadge &&
              (featuredBadge.tone === "unlimited" ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-600/15 text-amber-700 text-xs dark:text-amber-400"
                >
                  {featuredBadge.label}
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs">
                  {featuredBadge.label}
                </Badge>
              ))}

            {savingsBadge && (
              <Badge variant="default" className="text-xs">
                {savingsBadge}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {/* Price */}
        <div className="mb-6">
          <span className="text-foreground text-4xl font-extrabold">{formattedPrice}</span>
          <p className="text-muted-foreground mt-1 text-sm">{billingCycleLabel}</p>
          {monthlyEquivalent && (
            <p className="text-muted-foreground mt-0.5 text-xs">{monthlyEquivalent}</p>
          )}
        </div>

        {/* Features list */}
        <ul className="flex-1 space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              {feature.included ? (
                <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Minus className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span className={cn(feature.included ? "text-foreground" : "text-muted-foreground")}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-auto pt-6">{cta ?? <div className="h-10" />}</div>
      </CardContent>
    </Card>
  );
}
