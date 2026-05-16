"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { KanbanColumnHeader } from "./KanbanColumnHeader";
import { JobCard, type JobCardJob } from "./JobCard";

// ---------------------------------------------------------------------------
// KanbanColumn — single column container: header + sortable card list.
//
// SPEC §Column: bg-muted/30, border-border, rounded-lg, p-3, min-h-[200px].
// When `isOver` flips on (during a drag hover), add a dashed primary outline
// inset by 4px. The min-height stays constant whether the column is empty or
// hovered — past work showed that toggling min-height or unmounting the
// droppable on `isOver` creates a flicker loop and breaks drop targets.
//
// Empty drop zone is just whitespace — no placeholder text, no dashed inner
// box. The column-level min-height + droppable inner container handle the
// "drop into empty column" case.
//
// The droppable node IS the inner card list (`setNodeRef` lives there), not
// the outer column wrapper. This means cards become drop targets via the
// same node tree the SortableContext uses for ordering.
// ---------------------------------------------------------------------------

// Re-exporting the Status union from the page would require pulling the page
// into the dep tree; a local string keeps this file standalone.
type Status = string;

interface KanbanColumnProps {
  status: Status;
  label: string;
  jobs: JobCardJob[];
  onDelete: (jobId: string) => void;
}

export function KanbanColumn({
  status,
  label,
  jobs,
  onDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-muted/30 p-3 h-full",
        "transition-colors",
        isOver && "outline outline-dashed outline-primary/40 outline-offset-[-4px]"
      )}
    >
      <KanbanColumnHeader label={label} count={jobs.length} />

      <SortableContext
        id={status}
        items={jobs.map((j) => j.id)}
        strategy={rectSortingStrategy}
      >
        <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
