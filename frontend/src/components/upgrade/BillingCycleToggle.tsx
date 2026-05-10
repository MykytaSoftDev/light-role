"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export interface BillingCycleToggleProps {
  value: "monthly" | "annual";
  onChange: (v: "monthly" | "annual") => void;
  monthlyLabel: string;
  annualLabel: string;
  savingsBadgeLabel?: string;
}

export function BillingCycleToggle({
  value,
  onChange,
  monthlyLabel,
  annualLabel,
  savingsBadgeLabel,
}: BillingCycleToggleProps) {
  const tSub = useTranslations("Subscriptions.details");
  return (
    <div
      role="group"
      aria-label={tSub("billingCycle")}
      className="border-border bg-muted inline-flex items-center rounded-lg border p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          value === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {monthlyLabel}
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === "annual"}
        onClick={() => onChange("annual")}
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          value === "annual"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {annualLabel}
      </button>
    </div>
  );
}
