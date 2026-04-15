"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeOverlay() {
  const t = useTranslations("analytics");

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center p-6"
      role="region"
      aria-label={t("upgrade_overlay_aria_label")}
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-lg p-8 flex flex-col items-center gap-4 text-center max-w-sm w-full">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/60">
          <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{t("upgrade_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("upgrade_description")}</p>
        </div>
        <Button asChild size="lg" className="w-full mt-2">
          <Link href={DASHBOARD_PAGES.UPGRADE}>{t("upgrade_cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
