"use client";

import { useTranslations } from "next-intl";
import type { HeroCounters } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  delta: number;
}

function StatCard({ label, value, delta }: StatCardProps) {
  const deltaEl = (() => {
    if (delta > 0) {
      return (
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ↑+{delta}
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
          ↓{delta}
        </span>
      );
    }
    return <span className="text-sm font-medium text-muted-foreground">—</span>;
  })();

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {deltaEl}
    </div>
  );
}

interface HeroStatsProps {
  counters: HeroCounters;
}

export function HeroStats({ counters }: HeroStatsProps) {
  const t = useTranslations("analytics");

  const cards: { label: string; value: number; delta: number }[] = [
    { label: t("hero_jobs_saved"), value: counters.jobs_saved, delta: counters.jobs_saved_delta },
    { label: t("hero_applied"), value: counters.applied, delta: counters.applied_delta },
    { label: t("hero_interviews"), value: counters.interviews, delta: counters.interviews_delta },
    { label: t("hero_offers"), value: counters.offers, delta: counters.offers_delta },
  ];

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4")}>
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
