"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobContextMenu } from "@/components/jobs/job-context-menu";
import { ExcitementStars } from "./ExcitementStars";

// ---------------------------------------------------------------------------
// Types — duplicated minimal shape from page.tsx so this file is standalone.
// Matches the Job interface used in /dashboard/jobs/page.tsx.
// ---------------------------------------------------------------------------

interface Application {
  id: string;
  job_id: string;
  status: string;
  date_applied: string | null;
  deadline: string | null;
  follow_up_date: string | null;
  excitement_level: number | null;
  notes: string | null;
  resume_id: string | null;
  cover_letter_id: string | null;
}

export interface JobCardJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  is_ai_parsed: boolean;
  created_at: string;
  application: Application;
  tailored_resume: { id: string; name: string; match_score?: number | null; updated_at: string } | null;
  cover_letters: { id: string; name: string; updated_at: string }[];
}

// ---------------------------------------------------------------------------
// JobCardSurface — pure presentational card (no DnD wiring).
//
// Used in two places: rendered inside the `useSortable`-wrapped <JobCard>
// below, AND rendered standalone in the page's <DragOverlay> clone (pass
// `isDragging` so the translucent drag style is applied).
//
// Per SPEC: no rotate, no ring on drag, no shadow-lg on the card itself.
// The drag-visible styling lives only on the DragOverlay clone via
// `isDragging` → opacity-50 + shadow-md + cursor-grabbing.
// ---------------------------------------------------------------------------

interface JobCardSurfaceProps {
  job: JobCardJob;
  isDragging?: boolean;
  onDelete: (jobId: string) => void;
}

export function JobCardSurface({
  job,
  isDragging = false,
  onDelete,
}: JobCardSurfaceProps) {
  const t = useTranslations("Jobs.list");
  return (
    <div
      className={cn(
        "group rounded-md border border-border bg-card p-3 select-none cursor-grab",
        "transition-colors",
        "hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isDragging && "opacity-50 shadow-md cursor-grabbing"
      )}
    >
      {/* Top row: company + role on the left, context menu on the right */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/jobs/${job.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0"
        >
          <p className="font-semibold text-sm text-foreground truncate">
            {job.company}
          </p>
          <p className="text-sm text-muted-foreground truncate">{job.title}</p>
        </Link>
        <JobContextMenu
          job={job}
          onDelete={onDelete}
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted focus:opacity-100 focus:outline-none"
              aria-label={t("openJobMenuAria")}
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          }
        />
      </div>

      {job.application.excitement_level && job.application.excitement_level > 0 ? (
        <div className="mt-2">
          <ExcitementStars level={job.application.excitement_level} />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobCard — DnD-sortable wrapper around JobCardSurface.
//
// The wrapper element receives the @dnd-kit transform/transition and listeners.
// When dragging, the original card is hidden (opacity: 0) so the DragOverlay
// clone is the only visible representation — preventing the double-card
// glitch where both the source and the overlay render simultaneously.
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: JobCardJob;
  onDelete: (jobId: string) => void;
}

export function JobCard({ job, onDelete }: JobCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCardSurface job={job} onDelete={onDelete} />
    </div>
  );
}
