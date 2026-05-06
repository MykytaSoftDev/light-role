"use client";

/**
 * TAILOR-9 / TAILOR-11 — Edit-mode toolbar.
 *
 * Replaces the Edit-button slot when the editor is in Edit mode. Hosts:
 *   - Font selector (TAILOR-11)
 *   - Reorder sections trigger (TAILOR-11)
 *   - Cancel button
 *   - Save button (disabled when clean; spinner while in flight)
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §3.
 *
 * Responsive layout per spec §3.5: at <768px the toolbar wraps to two rows
 * (Font+Reorder on top, Cancel+Save below) and labels collapse to icons in
 * the tablet tier. We achieve this with flex-wrap + responsive utility classes.
 */
import * as React from "react";
import { LayoutList, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FontSelect } from "./font-select";

interface EditModeToolbarProps {
  font: string;
  onFontChange: (font: string) => void;
  onOpenReorder: () => void;
  onCancel: () => void;
  onSave: () => void;
  isDirty: boolean;
  isSaving: boolean;
  /**
   * When false, Save is force-disabled regardless of `isDirty`. Used to
   * gate Save on real-time validation (e.g. invalid email).
   */
  isValid?: boolean;
}

export function EditModeToolbar({
  font,
  onFontChange,
  onOpenReorder,
  onCancel,
  onSave,
  isDirty,
  isSaving,
  isValid = true,
}: EditModeToolbarProps) {
  const saveDisabled = !isDirty || isSaving || !isValid;

  return (
    <div
      role="toolbar"
      aria-label="Edit resume"
      // Lives inside the canvas (above the document) via the `topSlot` of
      // EditablePreview. Fills the slot horizontally and uses bg-card for
      // contrast against the canvas background. `flex-wrap` enables the
      // mobile two-row layout.
      className="
        flex flex-wrap items-center gap-2 w-full
        py-2 px-3
        rounded-md border border-border bg-card shadow-sm
      "
    >
      <FontSelect
        value={font}
        onChange={onFontChange}
        disabled={isSaving}
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        onClick={onOpenReorder}
        disabled={isSaving}
        aria-label="Reorder sections"
      >
        <LayoutList className="h-4 w-4" />
        <span className="hidden md:inline">Reorder sections</span>
      </Button>

      <div className="flex-grow" />

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8"
        onClick={onCancel}
        disabled={isSaving}
      >
        Cancel
      </Button>

      <Button
        type="button"
        size="sm"
        className="h-8"
        onClick={onSave}
        disabled={saveDisabled}
        title={
          !isValid
            ? "Fix the highlighted fields before saving"
            : !isDirty
              ? "No changes to save"
              : undefined
        }
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save"
        )}
      </Button>
    </div>
  );
}
