"use client";

/**
 * TAILOR-10 — Generic editable entry block.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.2 + §4.2.
 *
 * Wraps one entry (within a section that has an array of entries) with:
 *   - Hover outline (a faint primary border on hover, doesn't affect layout)
 *   - Left-gutter drag handle (within-section reorder)
 *   - Top-right Trash icon (delete from draft)
 *
 * The drag affordance is wired via `useSortable` from `@dnd-kit/sortable`.
 * The parent section provides `<DndContext>` + `<SortableContext>`.
 */
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface EditableEntryProps {
  id: string;
  /** Friendly name shown to screen readers — e.g. "Experience entry". */
  label?: string;
  onRemove: () => void;
  children: React.ReactNode;
}

export function EditableEntry({
  id,
  label,
  onRemove,
  children,
}: EditableEntryProps) {
  const tEditor = useTranslations("Resumes.editor.section");
  const resolvedLabel = label ?? tEditor("employmentEntryLabel");
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
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // `group/entry` pairs with the hover affordances below.
        "group/entry relative rounded-sm py-1",
        // Outline (not border) so the document layout is unaffected.
        "outline outline-1 outline-transparent transition-colors",
        "hover:outline-primary/20 focus-within:outline-primary/40",
        isDragging && "opacity-60"
      )}
    >
      {/* Left-gutter drag handle (visible on hover) */}
      <button
        type="button"
        aria-label={tEditor("dragEntryAria", { label: resolvedLabel })}
        className={cn(
          "absolute -left-6 top-1 cursor-grab touch-none rounded p-0.5",
          "text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing",
          "opacity-0 group-hover/entry:opacity-100 focus:opacity-100",
          "transition-opacity"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Top-right trash icon (visible on hover) */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={tEditor("removeEntryAria", { label: resolvedLabel })}
        className={cn(
          "absolute -right-6 top-1 rounded p-0.5",
          "text-muted-foreground hover:text-destructive",
          "opacity-0 group-hover/entry:opacity-100 focus:opacity-100",
          "transition-opacity"
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {children}
    </div>
  );
}
