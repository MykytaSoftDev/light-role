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

export interface PricingCardProps {
  title: string;
  description: string;
  formattedPrice: string;
  billingCycleLabel: string;
  monthlyEquivalent?: string;
  savingsBadge?: string;
  features: PricingFeature[];
  highlighted: boolean;
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
  highlighted,
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

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col transition-all duration-200",
        highlighted
          ? "pricing-card-gradient-featured ring-1 ring-indigo-400/50"
          : "pricing-card-gradient"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-foreground text-lg font-bold">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {currentPlanBadge && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Current plan
            </Badge>
          )}

          {highlighted && savingsBadge && (
            <Badge variant="default" className="shrink-0 text-xs">
              {savingsBadge}
            </Badge>
          )}
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
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
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
