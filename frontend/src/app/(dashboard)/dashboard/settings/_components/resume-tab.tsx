"use client";

/**
 * Resume Preferences settings tab — PREFS-1.
 *
 * Renders three blocks: info banner, Section Order, Font.
 *
 * INTENTIONALLY OMITTED in MVP: the Template block (third card per
 * PRD §3.8.3). Backend stores `template: "classic"` and rejects writes
 * to that key (see backend tasks). When multi-template support ships
 * (Phase 5+), add a TemplateCard component below FontCard:
 *
 *   <TemplateCard value={prefs.template} onSave={...} />
 *
 * Use lucide `LayoutTemplate` for the card title icon — already
 * referenced here to keep the import surface stable across phases.
 *
 * Spec: docs/v2/specs/resume-preferences-spec.md
 */
import { useTranslations } from "next-intl";

import { useUser } from "@/hooks/api/useUser";
import type { ResumeFont } from "@/lib/fonts/resume-fonts";

import { FontCard } from "./resume/font-card";
import { ResumeInfoBanner } from "./resume/resume-info-banner";
import { SectionOrderCard } from "./resume/section-order-card";

export function ResumeTab() {
  const t = useTranslations("settings.resume");
  const { data: user, isLoading, isError, refetch } = useUser();

  const prefs = user?.resume_preferences;
  // Cast is safe — backend constrains font to KNOWN_FONTS, which mirrors the
  // ResumeFont union exactly. The font-card revalidates on selection.
  const serverFont = prefs?.font as ResumeFont | undefined;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tab header — matches account-tab.tsx pattern */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <ResumeInfoBanner />

      <SectionOrderCard
        serverOrder={prefs?.sections_order}
        isLoading={isLoading}
        isLoadError={isError}
        onRetryLoad={() => refetch()}
      />

      <FontCard
        serverFont={serverFont}
        isLoading={isLoading}
        isLoadError={isError}
        onRetryLoad={() => refetch()}
      />
    </div>
  );
}
