"use client";

/**
 * PREFS-1 — info banner shown above the Section Order / Font cards.
 *
 * Spec: docs/v2/specs/resume-preferences-spec.md §3.2.
 *
 * Static copy — no states. Always renders, even while preferences load.
 */
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ResumeInfoBanner() {
  const t = useTranslations("settings.resume.infoBanner");

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("body")}</AlertDescription>
    </Alert>
  );
}
