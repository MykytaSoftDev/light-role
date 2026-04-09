"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PricingCardProps {
  title: string;
  description: string;
  formattedPrice: string;
  billingCycleLabel: string;
  monthlyEquivalent?: string;
  savingsBadge?: string;
  features: string[];
  ctaLabel: string;
  onCtaClick: () => void;
  highlighted: boolean;
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
  ctaLabel,
  onCtaClick,
  highlighted,
  loading = false,
}: PricingCardProps) {
  if (loading) {
    return (
      <Card className="flex flex-1 flex-col p-6">
        <Skeleton className="mb-2 h-6 w-32" />
        <Skeleton className="mb-6 h-4 w-48" />
        <Skeleton className="mb-1 h-10 w-24" />
        <Skeleton className="mb-6 h-3 w-20" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
        "relative flex flex-1 flex-col transition-all duration-200",
        highlighted && "shadow-lg ring-2 ring-indigo-500 scale-[1.02]"
      )}
    >
      {savingsBadge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 text-xs font-semibold">
            {savingsBadge}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <h3 className="text-foreground text-lg font-bold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {/* Price */}
        <div className="mb-6">
          <span className="text-foreground text-4xl font-extrabold">{formattedPrice}</span>
          <p className="text-muted-foreground mt-1 text-sm">{billingCycleLabel}</p>
          {monthlyEquivalent && (
            <p className="text-muted-foreground text-xs mt-0.5">{monthlyEquivalent}</p>
          )}
        </div>

        {/* Features list */}
        <ul className="mb-6 flex-1 space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          onClick={onCtaClick}
          className={cn(
            "w-full font-semibold",
            highlighted
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : ""
          )}
          variant={highlighted ? "default" : "outline"}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
