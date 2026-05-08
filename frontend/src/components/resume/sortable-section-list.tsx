"use client";

/**
 * Shared sortable section list — extracted for PREFS-1.
 *
 * Wraps the dnd-kit `DndContext` + `SortableContext` plus a single sortable
 * row, plus the `normalizeOrder` helper that defends against schema drift.
 *
 * Two consumers today:
 *   - `frontend/src/app/(dashboard)/dashboard/resumes/[id]/_components/reorder-sections-dialog.tsx`
 *     (TAILOR-11). The dialog owns its `workingOrder` state + entry-count
 *     `rightSlot`. It calls this component to render the list body.
 *   - `frontend/src/app/(dashboard)/dashboard/settings/_components/resume/section-order-card.tsx`
 *     (PREFS-1). The settings card owns `localOrder` + dirty-tracking. It
 *     does not pass `rightSlot` — counts are not relevant in settings.
 *
 * Source of truth for the 9 reorderable section keys + their display labels.
 * Both `reorder-sections-dialog.tsx` and `applied-changes-accordion.tsx`
 * (TAILOR-12 Insights panel) re-export `SECTION_LABELS` /
 * `REORDERABLE_SECTION_KEYS` from the dialog, which now in turn re-exports
 * from this file. No call-site import paths needed to change.
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

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Section keys + labels
// ---------------------------------------------------------------------------

/**
 * The 9 reorderable section keys, in their canonical default order
 * (per PRD §6.3 / `models/user.py:_resume_preferences_default`).
 *
 * NOTE: this matches the backend `KNOWN_SECTION_KEYS` exactly. The default
 * order on a fresh user is also this order — `users.resume_preferences`
 * default JSONB. The settings tab must use the *server-persisted* order as
 * the source of truth at runtime; this constant is only for normalization
 * of unknown / missing keys.
 */
export const REORDERABLE_SECTION_KEYS = [
  "summary",
  "employment",
  "education",
  "projects",
  "skills",
  "certificates",
  "languages",
  "achievements",
  "volunteer",
] as const;

export type ReorderableSectionKey = (typeof REORDERABLE_SECTION_KEYS)[number];

/**
 * Display labels for the 9 reorderable sections. Single source of truth —
 * also re-exported from `reorder-sections-dialog.tsx` for the Insights panel
 * (TAILOR-12) which already imports from there.
 */
export const SECTION_LABELS: Record<ReorderableSectionKey, string> = {
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
// Row
// ---------------------------------------------------------------------------

interface SortableSectionRowProps {
  id: ReorderableSectionKey;
  label: string;
  /** Optional right-aligned slot per row. If omitted, no extra content. */
  rightContent?: React.ReactNode;
}

function SortableSectionRow({
  id,
  label,
  rightContent,
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
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent/50",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${label} to reorder`}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      {rightContent != null && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {rightContent}
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface SortableSectionListProps {
  /** Stored section keys in current order. Will be normalized for render. */
  value: string[];
  /** Called with the new normalized order on every drop. */
  onChange: (next: ReorderableSectionKey[]) => void;
  /** Display labels for each key. Defaults to SECTION_LABELS. */
  sectionLabels?: Record<ReorderableSectionKey, string>;
  /** Optional right-slot content per row. Settings tab passes nothing. */
  rightSlot?: (key: ReorderableSectionKey) => React.ReactNode;
  /** Tailwind classes applied to the outer `<ul>`. */
  className?: string;
}

export function SortableSectionList({
  value,
  onChange,
  sectionLabels = SECTION_LABELS,
  rightSlot,
  className,
}: SortableSectionListProps) {
  // Always render a normalized order — defends against schema drift.
  const order = React.useMemo(() => normalizeOrder(value), [value]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as ReorderableSectionKey);
    const newIdx = order.indexOf(over.id as ReorderableSectionKey);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(order, oldIdx, newIdx));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className={cn("space-y-1.5", className)}>
          {order.map((key) => (
            <SortableSectionRow
              key={key}
              id={key}
              label={sectionLabels[key]}
              rightContent={rightSlot?.(key)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reduces an arbitrary stored order to the 9 known section keys, preserving
 * stored order. Missing keys are appended at the bottom. Defensive — should
 * not happen but keeps the UI robust against schema drift.
 */
export function normalizeOrder(stored: string[]): ReorderableSectionKey[] {
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
