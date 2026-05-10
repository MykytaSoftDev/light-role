"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

interface CoverLettersEmptyStateProps {
  /**
   * - `empty`: user has zero cover letters. Show the "create your first"
   *   wizard CTA.
   * - `no-matches`: user has CLs but the active filters narrow to zero.
   *   Show a "Clear filters" CTA.
   */
  variant: "empty" | "no-matches";
  onClearFilters?: () => void;
}

/**
 * Two empty-state variants for the cover-letters list page (CL-10).
 *
 * Distinct variants because the actions differ — sending a user with
 * active filters straight to the wizard would be a nasty surprise.
 */
export function CoverLettersEmptyState({
  variant,
  onClearFilters,
}: CoverLettersEmptyStateProps) {
  const t = useTranslations("coverLetters.list");
  if (variant === "no-matches") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          {t("noMatches.message")}
        </p>
        {onClearFilters && (
          <div className="mt-4">
            <Button variant="outline" onClick={onClearFilters}>
              {t("noMatches.cta")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title={t("empty.title")}
        description={t("empty.description")}
        action={{
          label: t("empty.cta"),
          href: "/dashboard/cover-letters/generate",
        }}
      />
    </div>
  );
}
