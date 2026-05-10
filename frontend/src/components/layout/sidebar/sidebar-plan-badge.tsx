"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

export function SidebarPlanBadge() {
  const { plan, isUnlimitedPlan, isLoading } = usePlan();
  const t = useTranslations("Sidebar.planBadge");

  if (isLoading) {
    return (
      <Skeleton className="h-5 w-12 rounded-md group-data-[collapsible=icon]:hidden" />
    );
  }

  // Plan badge labels are short ("Free" / "Pro" / "Unlimited"). Reusing the
  // longer `Sidebar.planBadge.*Plan` keys would change the visual density, so
  // we use the dedicated short variants here.
  const label =
    plan === "pro"
      ? t("shortPro")
      : plan === "unlimited"
        ? t("shortUnlimited")
        : t("shortFree");

  const classes = cn(
    "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
    "group-data-[collapsible=icon]:hidden",
    plan === "pro" && "border-primary/30 bg-primary/10 text-primary",
    plan === "unlimited" &&
      "border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-600/15 text-amber-700 dark:text-amber-400",
    (!plan || plan === "free") && "bg-muted text-muted-foreground",
  );

  if (isUnlimitedPlan) {
    return <span className={classes}>{label}</span>;
  }

  return (
    <Link
      href={DASHBOARD_PAGES.UPGRADE}
      className={classes}
      aria-label={t("aria", { label })}
    >
      {label}
    </Link>
  );
}
