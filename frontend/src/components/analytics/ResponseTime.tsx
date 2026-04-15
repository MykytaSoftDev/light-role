"use client";

import { useTranslations } from "next-intl";
import type { ResponseTimeData } from "@/lib/types/analytics";

interface ResponseTimeProps {
  responseTime: ResponseTimeData;
}

export function ResponseTime({ responseTime }: ResponseTimeProps) {
  const t = useTranslations("analytics");

  if (responseTime.avg_days === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("response_time_title")}</h2>
        <p className="text-muted-foreground text-sm">{t("response_time_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("response_time_title")}</h2>
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-bold tracking-tight">
          {responseTime.avg_days.toFixed(1)}
          <span className="text-xl text-muted-foreground ml-1">{t("response_time_days_unit")}</span>
        </span>
        <span className="text-sm text-muted-foreground">{t("response_time_label")}</span>
      </div>
    </div>
  );
}
