"use client";

import { Award, Bookmark, MessageCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AnalyticsResponse } from "@/lib/types/analytics";

import { KpiCard } from "./kpi-card";

interface KpiStripProps {
  data: AnalyticsResponse;
}

/**
 * Row 2 of the analytics page. Renders 4 KpiCard instances mapped from the
 * four headline metrics on the response (saved / applied / interviews /
 * offers). Layout collapses 2 columns on mobile (<md), 4 columns on
 * desktop (>=md).
 *
 * Icons are picked from lucide-react (Tabler isn't installed):
 *   - Bookmark      → Saved
 *   - Send          → Applied
 *   - MessageCircle → Interviews
 *   - Award         → Offers
 */
export function KpiStrip({ data }: KpiStripProps) {
  const t = useTranslations("analytics");
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        icon={Bookmark}
        label={t("kpi_jobs_saved")}
        current={data.jobs_saved.current}
        delta={data.jobs_saved.delta}
        sparkline={data.jobs_saved.sparkline}
      />
      <KpiCard
        icon={Send}
        label={t("kpi_applied")}
        current={data.applied.current}
        delta={data.applied.delta}
        sparkline={data.applied.sparkline}
      />
      <KpiCard
        icon={MessageCircle}
        label={t("kpi_interviews")}
        current={data.interviews.current}
        delta={data.interviews.delta}
        sparkline={data.interviews.sparkline}
      />
      <KpiCard
        icon={Award}
        label={t("kpi_offers")}
        current={data.offers.current}
        delta={data.offers.delta}
        sparkline={data.offers.sparkline}
      />
    </div>
  );
}
