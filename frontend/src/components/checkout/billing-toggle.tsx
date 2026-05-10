"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface BillingToggleProps {
  value: "monthly" | "annual";
  onChange: (v: "monthly" | "annual") => void;
  disabled?: boolean;
  savingsPercent?: number;
}

export function BillingToggle({
  value,
  onChange,
  disabled = false,
  savingsPercent,
}: BillingToggleProps) {
  const t = useTranslations("Checkout.billingToggle");
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        disabled={disabled}
        className={cn(
          "relative rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value === "monthly"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("monthly")}
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        disabled={disabled}
        className={cn(
          "relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value === "annual"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("annual")}
        {savingsPercent != null && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              value === "annual"
                ? "bg-green-500/20 text-green-100"
                : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
            )}
          >
            {t("save", { percent: savingsPercent })}
          </span>
        )}
      </button>
    </div>
  );
}
