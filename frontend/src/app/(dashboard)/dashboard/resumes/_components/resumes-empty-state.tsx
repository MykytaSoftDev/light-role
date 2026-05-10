"use client";

import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

interface ResumesEmptyStateProps {
  /**
   * - `empty`: user has zero tailored resumes. Show the "create your first"
   *   wizard CTA.
   * - `no-matches`: user has resumes but the active filters narrow to zero.
   *   Show a "Clear filters" CTA.
   */
  variant: "empty" | "no-matches";
  onClearFilters?: () => void;
}

/**
 * Two empty-state variants for the resumes list page (TAILOR-15 §5).
 *
 * Distinct variants because the actions differ — sending a user with active
 * filters straight to the wizard would be a nasty surprise.
 */
export function ResumesEmptyState({
  variant,
  onClearFilters,
}: ResumesEmptyStateProps) {
  const t = useTranslations("Resumes.list");
  if (variant === "no-matches") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
        {onClearFilters && (
          <div className="mt-4">
            <Button variant="outline" onClick={onClearFilters}>
              {t("clear")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title={t("empty.title")}
        description={t("empty.description")}
        action={{
          label: t("empty.cta"),
          href: "/dashboard/resumes/tailor",
        }}
      />
    </div>
  );
}
