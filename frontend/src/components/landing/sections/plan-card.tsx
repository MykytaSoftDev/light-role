import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  name: string;
  price: string;
  priceSuffix: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: "default" | "outline";
  featured?: boolean;
  featuredLabel?: string;
}

export function PlanCard({
  name,
  price,
  priceSuffix,
  description,
  ctaLabel,
  ctaHref,
  ctaVariant,
  featured = false,
  featuredLabel,
}: PlanCardProps) {
  return (
    <div className="relative">
      {featured && featuredLabel && (
        <Badge
          className="absolute top-0 left-7 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 bg-[var(--color-primary)] text-[var(--color-primary-fg)] border-transparent"
        >
          {featuredLabel}
        </Badge>
      )}
      <Card
        className={cn(
          "rounded-[14px] p-8 bg-[var(--color-background)] flex flex-col gap-3.5 h-full shadow-none border-[var(--color-border)]",
          featured &&
            "border-[var(--color-primary)] shadow-[0_0_0_4px_var(--color-primary-10)]",
        )}
      >
        <h3 className="m-0 font-display text-[18px] font-semibold text-[var(--color-foreground)]">
          {name}
        </h3>
        <div className="flex items-baseline gap-1.5">
          <div className="font-display text-[48px] font-bold tracking-[-0.04em] leading-none text-[var(--color-foreground)]">
            {price}
          </div>
          <div className="font-mono text-[12px] text-[var(--color-muted-fg)]">
            {priceSuffix}
          </div>
        </div>
        <p className="m-0 font-body text-[14px] leading-[1.5] text-[var(--color-muted-fg)]">
          {description}
        </p>
        <div className="mt-auto pt-2">
          <Button asChild size="lg" variant={ctaVariant} className="w-full">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
