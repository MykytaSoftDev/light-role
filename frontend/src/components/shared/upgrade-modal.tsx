"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { UpgradeReason } from "@/hooks/use-upgrade-modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: UpgradeReason;
  currentUsage?: number;
  limit?: number;
  resetDate?: string;
}

// ---------------------------------------------------------------------------
// Pricing card
// ---------------------------------------------------------------------------

interface PricingCardProps {
  label: string;
  price: string;
  period: string;
  badge?: string;
  highlight?: boolean;
  onSelect: () => void;
}

function PricingCard({ label, price, period, badge, highlight, onSelect }: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border p-5 transition-all",
        highlight
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-muted/20"
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground whitespace-nowrap">
          {badge}
        </span>
      )}
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{price}</span>
          <span className="text-xs text-muted-foreground">{period}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 shrink-0 text-primary" />
          100 AI operations / month
        </li>
        <li className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 shrink-0 text-primary" />
          Unlimited active jobs
        </li>
      </ul>
      <Button
        size="sm"
        variant={highlight ? "default" : "outline"}
        className="mt-1 w-full"
        onClick={onSelect}
      >
        Upgrade to Pro
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function UpgradeModal({
  open,
  onClose,
  reason,
  currentUsage,
  limit,
  resetDate,
}: UpgradeModalProps) {
  const router = useRouter();

  const isAiLimit = reason === "ai_limit";

  const title = isAiLimit ? "AI operation limit reached" : "Job limit reached";

  const description = isAiLimit
    ? `You've used ${currentUsage ?? "all"} of your ${limit ?? 10} AI operations this month.`
    : `You've reached the limit of ${limit ?? 10} active jobs on the free plan.`;

  const resetLabel = (() => {
    if (!resetDate) return null;
    const date = new Date(resetDate);
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  })();

  function handleUpgrade() {
    onClose();
    router.push("/dashboard/settings/billing");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {resetLabel && isAiLimit && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Your limit resets on {resetLabel}.
            </p>
          )}
        </DialogHeader>

        <p className="text-sm font-medium text-foreground">Upgrade to Pro to continue</p>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <PricingCard
            label="Monthly"
            price="$9"
            period="/ month"
            onSelect={handleUpgrade}
          />
          <PricingCard
            label="Annual"
            price="$69"
            period="/ year"
            badge="Save 36%"
            highlight
            onSelect={handleUpgrade}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No hidden fees.
        </p>
      </DialogContent>
    </Dialog>
  );
}
