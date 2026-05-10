"use client";

/**
 * TAILOR-11 — Reorder sections dialog.
 *
 * Modal dialog with a vertical dnd-kit sortable list of the 9 reorderable
 * sections (excluding `personal_info`, which is the fixed document header).
 * Local-local working order is committed to the draft only on `Save order`.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §5.
 *
 * After PREFS-1: the dnd-kit internals (`DndContext`, `SortableContext`,
 * sortable row, sensors, `normalizeOrder`) live in
 *   frontend/src/components/resume/sortable-section-list.tsx
 * — this file owns the dialog shell, the `workingOrder` working-state
 * model, and the entry-count derivation. `SECTION_LABELS` /
 * `REORDERABLE_SECTION_KEYS` / `ReorderableSectionKey` continue to be
 * exported from here so the Insights side panel (TAILOR-12
 * `applied-changes-accordion.tsx`) keeps importing from this file.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  REORDERABLE_SECTION_KEYS,
  SECTION_LABELS,
  SortableSectionList,
  normalizeOrder,
  type ReorderableSectionKey,
} from "@/components/resume/sortable-section-list";
import type { ProfileData } from "@/lib/profile-api";

// ---------------------------------------------------------------------------
// Re-exports — keep the existing import paths working for downstream
// consumers (TAILOR-12 Insights panel imports SECTION_LABELS / type from here).
// ---------------------------------------------------------------------------

export { REORDERABLE_SECTION_KEYS, SECTION_LABELS };
export type { ReorderableSectionKey };

// ---------------------------------------------------------------------------
// Entry-count derivation — dialog-only concern
// ---------------------------------------------------------------------------

function entryCountFor(
  key: ReorderableSectionKey,
  data: ProfileData
): number | "filled" | "empty" {
  if (key === "summary") {
    return data.summary && data.summary.trim() !== "" ? "filled" : "empty";
  }
  const list = data[key as Exclude<ReorderableSectionKey, "summary">];
  return Array.isArray(list) ? list.length : 0;
}

function makeFormatCount(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return (count: number | "filled" | "empty"): string => {
    if (count === "filled") return t("entryCountFilledLabel", { count: 1 });
    if (count === "empty") return "—";
    if (count === 0) return "—";
    if (count === 1) return t("entryCountOneEntry");
    return t("entryCountOtherEntries", { count });
  };
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

interface ReorderSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current draft sections order. */
  currentOrder: string[];
  /** The current draft tailored data — used to derive entry counts. */
  data: ProfileData;
  /** Called with the new order on Save. */
  onSave: (newOrder: string[]) => void;
}

export function ReorderSectionsDialog({
  open,
  onOpenChange,
  currentOrder,
  data,
  onSave,
}: ReorderSectionsDialogProps) {
  const t = useTranslations("Resumes.editor.reorderDialog");
  const tSection = useTranslations("Resumes.sectionTitles");
  const formatCount = React.useMemo(() => makeFormatCount(t), [t]);
  // Build a translated section label map for the sortable list.
  const translatedLabels: Record<ReorderableSectionKey, string> = React.useMemo(
    () => ({
      summary: tSection("summary"),
      employment: tSection("employment"),
      education: tSection("education"),
      skills: tSection("skills"),
      languages: tSection("languages"),
      certificates: tSection("certificates"),
      projects: tSection("projects"),
      achievements: tSection("achievements"),
      volunteer: tSection("volunteer"),
    }),
    [tSection]
  );
  // Local-local working order. Re-initializes every time the dialog opens.
  const [workingOrder, setWorkingOrder] = React.useState<ReorderableSectionKey[]>(
    () => normalizeOrder(currentOrder)
  );

  React.useEffect(() => {
    if (open) {
      setWorkingOrder(normalizeOrder(currentOrder));
    }
  }, [open, currentOrder]);

  function handleSave() {
    onSave(workingOrder);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <SortableSectionList
          value={workingOrder}
          onChange={setWorkingOrder}
          sectionLabels={translatedLabels}
          rightSlot={(key) => formatCount(entryCountFor(key, data))}
          className="space-y-2 py-2"
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
