"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FunnelStage } from "@/lib/types/analytics";

interface FunnelCardProps {
  funnel: FunnelStage[];
  funnelInsight: string | null;
}

// Fixed stage order — even when the backend omits zero-count stages we still
// render five rows (SPEC §9.5 empty-state behaviour).
const STAGE_ORDER: Array<FunnelStage["stage"]> = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
];

// Frontend → translation-key map. SPEC §4.5 declares the stage labels used in
// the funnel + donut differ for `applied` (funnel uses "Отклик отправлен";
// donut uses the same — but the i18n key names are identical, so we share
// `funnel_stage_*`).
const STAGE_TRANSLATION_KEY: Record<FunnelStage["stage"], string> = {
  saved: "funnel_stage_saved",
  applied: "funnel_stage_applied",
  screening: "funnel_stage_screening",
  interview: "funnel_stage_interview",
  offer: "funnel_stage_offer",
};

/**
 * Backend `funnel_insight` is currently a hardcoded Russian string from
 * `_generate_funnel_insight` (analytics_service.py §4.5). Map each known
 * Russian string to a translation key so other locales can localise too.
 *
 * Strategy: hash by string-match. Long-term the backend should return an
 * enum/key so we don't pay the string-match cost — that's a clean follow-up
 * patch. For now this lets the redesign ship without backend churn.
 *
 * Returns null when the input is null OR doesn't match a known string, so
 * the callout stays hidden rather than rendering an untranslated payload.
 */
const INSIGHT_BACKEND_RU_TO_KEY: Record<string, string> = {
  "Конверсия в оффер выше среднего — отличная работа":
    "funnel_insight_offer_conversion",
  "Конверсия в интервью выше среднего — продолжай в том же духе":
    "funnel_insight_interview_conversion",
  "Высокий процент откликов попадает в скрининг — резюме работает":
    "funnel_insight_screening_conversion",
  "Ты не складываешь вакансии в долгий ящик — это правильная привычка":
    "funnel_insight_applied_speed",
  "Неделя ежедневной активности — самое сложное позади":
    "funnel_insight_streak",
  "Продолжай — каждая поданная заявка приближает к офферу":
    "funnel_insight_default",
};

/**
 * Left column of row 3 — cumulative funnel from `saved` → `offer` with a
 * shadcn `Progress` bar per stage and an auto-generated insight callout at
 * the bottom.
 *
 * Stages missing from the input array still render with count=0 / 0% so the
 * shape of the funnel reads consistently across empty / partial / full data.
 */
export function FunnelCard({ funnel, funnelInsight }: FunnelCardProps) {
  const t = useTranslations("analytics");

  // Build a stage→data map so STAGE_ORDER can look up each row in O(1).
  const byStage = new Map<FunnelStage["stage"], FunnelStage>();
  for (const s of funnel) {
    byStage.set(s.stage, s);
  }

  const insightKey = funnelInsight
    ? INSIGHT_BACKEND_RU_TO_KEY[funnelInsight] ?? null
    : null;
  const insightText = insightKey ? t(insightKey) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-medium leading-none tracking-normal">
          {t("funnel_title")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("funnel_subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {STAGE_ORDER.map((stage) => {
          const row = byStage.get(stage);
          const count = row?.count ?? 0;
          const pct = row?.percentage_of_top ?? 0;
          return (
            <div key={stage} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">
                  {t(STAGE_TRANSLATION_KEY[stage])}
                </span>
                <span className="text-xs text-muted-foreground">
                  {count} · {pct.toFixed(0)}%
                </span>
              </div>
              <Progress value={pct} className="h-[7px]" />
            </div>
          );
        })}

        {insightText ? (
          <div
            className="mt-4 flex items-start gap-2 rounded-md p-3"
            style={{ background: "var(--accent)" }}
          >
            <Lightbulb
              className="size-4 shrink-0 mt-[1px]"
              style={{ color: "var(--accent-foreground)" }}
            />
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--accent-foreground)" }}
            >
              {insightText}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
