"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsPeriod } from "@/lib/types/analytics";

const PERIOD_KEYS: { value: AnalyticsPeriod; labelKey: string }[] = [
  { value: "7d", labelKey: "period_7d" },
  { value: "30d", labelKey: "period_30d" },
  { value: "90d", labelKey: "period_90d" },
  { value: "all", labelKey: "period_all" },
];

interface AnalyticsHeaderProps {
  /** Currently-selected period, resolved by the parent from `?period=`. */
  period: AnalyticsPeriod;
}

/**
 * Page heading + period-tab selector for /dashboard/analytics.
 *
 * Period state lives in the URL (`?period=…`) so deep links and back/forward
 * navigation Just Work. Tab clicks `router.push` while preserving any other
 * search params on the URL (e.g. a future `?status=…` filter).
 */
export function AnalyticsHeader({ period }: AnalyticsHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("analytics");

  function handlePeriodChange(next: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", next);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("page_title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("page_subtitle")}
        </p>
      </div>
      <Tabs value={period} onValueChange={handlePeriodChange}>
        <TabsList aria-label={t("period_selector_label")}>
          {PERIOD_KEYS.map(({ value, labelKey }) => (
            <TabsTrigger key={value} value={value}>
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
