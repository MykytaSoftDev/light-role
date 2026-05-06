"use client";

/**
 * TAILOR-10 — Generic editable section block.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.1 + §7.11.
 *
 * Provides:
 *   - Section title rule (matches ClassicTemplate's section header visually)
 *   - Optional empty-state placeholder
 *   - Optional `+ Add` button below the body
 *
 * The actual entries are passed as `children`. Sections that wrap arrays
 * (Employment etc.) typically render a `<DndContext>+<SortableContext>` of
 * `<EditableEntry>` children.
 */
import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditableSectionProps {
  /** Visible section title (e.g. "Experience"). */
  title: string;
  /** "+ Add experience" — the button label. Omit to hide the button. */
  addLabel?: string;
  onAdd?: () => void;
  /** When true, renders the empty-state dashed box. */
  isEmpty?: boolean;
  /** Empty-state copy, e.g. "No experience yet — click + to add." */
  emptyMessage?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EditableSection({
  title,
  addLabel,
  onAdd,
  isEmpty = false,
  emptyMessage = "No entries yet — click + to add.",
  className,
  children,
}: EditableSectionProps) {
  return (
    <section className={cn("resume-section group/section", className)}>
      <h2 className="resume-section-header">{title}</h2>
      <div className="resume-section-body">
        {isEmpty ? (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
        {addLabel && onAdd ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAdd}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
