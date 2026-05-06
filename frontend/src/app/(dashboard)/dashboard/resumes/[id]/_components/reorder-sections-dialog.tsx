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
 * Patterns reused from
 *   frontend/src/app/(dashboard)/dashboard/profile/_components/tabs/_shared/
 * — same DndContext + PointerSensor + KeyboardSensor + sortableKeyboardCoordinates.
 */
import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProfileData } from "@/lib/profile-api";

// ---------------------------------------------------------------------------
// Section keys + labels
// ---------------------------------------------------------------------------

export const REORDERABLE_SECTION_KEYS = [
  "summary",
  "employment",
  "education",
  "skills",
  "languages",
  "certificates",
  "projects",
  "achievements",
  "volunteer",
] as const;

export type ReorderableSectionKey = (typeof REORDERABLE_SECTION_KEYS)[number];

const SECTION_LABELS: Record<ReorderableSectionKey, string> = {
  summary: "Summary",
  employment: "Experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  certificates: "Certificates",
  projects: "Projects",
  achievements: "Achievements",
  volunteer: "Volunteer",
};

// ---------------------------------------------------------------------------
// Entry-count derivation
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

function formatCount(count: number | "filled" | "empty"): string {
  if (count === "filled") return "Filled";
  if (count === "empty") return "—";
  if (count === 0) return "—";
  if (count === 1) return "1 entry";
  return `${count} entries`;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface SortableSectionRowProps {
  id: ReorderableSectionKey;
  label: string;
  countLabel: string;
}

function SortableSectionRow({
  id,
  label,
  countLabel,
}: SortableSectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${label} to reorder`}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {countLabel}
      </span>
    </li>
  );
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
  // Local-local working order. Re-initializes every time the dialog opens.
  const [workingOrder, setWorkingOrder] = React.useState<ReorderableSectionKey[]>(
    () => normalizeOrder(currentOrder)
  );

  React.useEffect(() => {
    if (open) {
      setWorkingOrder(normalizeOrder(currentOrder));
    }
  }, [open, currentOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = workingOrder.indexOf(active.id as ReorderableSectionKey);
    const newIdx = workingOrder.indexOf(over.id as ReorderableSectionKey);
    if (oldIdx === -1 || newIdx === -1) return;
    setWorkingOrder(arrayMove(workingOrder, oldIdx, newIdx));
  }

  function handleSave() {
    onSave(workingOrder);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Reorder sections</DialogTitle>
          <DialogDescription>
            Drag sections to change the order they appear in your resume.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workingOrder}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2 py-2">
              {workingOrder.map((key) => (
                <SortableSectionRow
                  key={key}
                  id={key}
                  label={SECTION_LABELS[key]}
                  countLabel={formatCount(entryCountFor(key, data))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reduces an arbitrary stored order to the 9 known section keys, preserving
 * stored order. Missing keys are appended at the bottom (defensive — should
 * not happen but keeps the modal robust against schema drift).
 */
function normalizeOrder(stored: string[]): ReorderableSectionKey[] {
  const known = new Set<string>(REORDERABLE_SECTION_KEYS);
  const seen = new Set<string>();
  const out: ReorderableSectionKey[] = [];
  for (const key of stored) {
    if (known.has(key) && !seen.has(key)) {
      out.push(key as ReorderableSectionKey);
      seen.add(key);
    }
  }
  for (const key of REORDERABLE_SECTION_KEYS) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}
