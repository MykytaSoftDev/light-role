"use client";

import { Mail } from "lucide-react";
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
  if (variant === "no-matches") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No cover letters match your search.
        </p>
        {onClearFilters && (
          <div className="mt-4">
            <Button variant="outline" onClick={onClearFilters}>
              Clear filters
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
        title="No cover letters yet."
        description="Generate a tailored cover letter from one of your jobs in about 15 seconds."
        action={{
          label: "Generate Your First Cover Letter",
          href: "/dashboard/cover-letters/generate",
        }}
      />
    </div>
  );
}
