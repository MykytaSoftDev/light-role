"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface SortableEntryCardProps {
  id: string;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  dragLabel?: string;
  children: ReactNode;
}

/**
 * Generic sortable card used by the card-list profile tabs (Employment,
 * Education, Certificates, Projects, Achievements, Volunteer).
 *
 * Wraps `children` (the section-specific summary content) with a left drag
 * handle and right edit/delete action buttons. Reordering is driven by the
 * surrounding <DndContext>/<SortableContext> in `entry-list.tsx`.
 */
export function SortableEntryCard({
  id,
  onEdit,
  onDelete,
  // English defaults intended as fallback; callers should pass translated labels.
  editLabel = "Edit entry",
  deleteLabel = "Delete entry",
  dragLabel = "Drag to reorder",
  children,
}: SortableEntryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-md border bg-card p-3 shadow-sm",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        aria-label={dragLabel}
        className="mt-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">{children}</div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={editLabel}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
