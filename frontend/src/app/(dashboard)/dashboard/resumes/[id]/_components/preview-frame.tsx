"use client";

/**
 * TAILOR-8 / TAILOR-9 — Preview frame.
 *
 * Hairline-bordered container hosting `<ResumePreview>` plus the slot at the
 * top edge for the Edit button (Preview mode) or the Edit-mode toolbar
 * (Edit mode). `mode` swaps the border between solid hairline and dashed
 * primary outline per editor-edit-mode-spec §4.1.
 *
 * Hover affordances inside the document (drag handles, trash icons) are
 * deliberately NOT introduced in this pass — TAILOR-10 will layer them in.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.7,
 *       docs/v2/specs/editor-edit-mode-spec.md §4.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface PreviewFrameProps {
  /**
   * Editor mode. `"edit"` swaps the frame border to dotted primary so the
   * user knows the document is in edit mode. The actual document content
   * inside this frame is rendered identically in both modes (Pass 1).
   */
  mode?: "preview" | "edit";
  /**
   * The canvas / document area: typically `<ResumePreview>` or
   * `<EditablePreview>`. The Edit button / toolbar is NOT a sibling here —
   * it lives inside the canvas via the `topSlot` prop on those components,
   * sized to align with the scaled document width.
   */
  children: React.ReactNode;
}

export function PreviewFrame({ mode = "preview", children }: PreviewFrameProps) {
  const t = useTranslations("Resumes.editor");
  return (
    <div
      role="region"
      aria-label={t("preview")}
      className={cn(
        "rounded-md bg-card overflow-hidden transition-all duration-200",
        mode === "edit"
          ? "border-2 border-dashed border-primary/50"
          : "border border-border"
      )}
    >
      {children}
    </div>
  );
}
