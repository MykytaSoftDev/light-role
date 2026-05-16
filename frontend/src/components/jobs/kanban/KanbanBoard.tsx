"use client";

import { useTranslations } from "next-intl";
import { KanbanColumn } from "./KanbanColumn";
import { STATUSES, type Status } from "./statuses";
import type { JobCardJob } from "./JobCard";

// ---------------------------------------------------------------------------
// KanbanBoard — full 8-column horizontally-scrollable board.
//
// Renders every status from STATUSES (saved, applied, screening, interview,
// offer, accepted, rejected, withdrawn) in canonical left-to-right order.
//
// Layout: always a horizontal flex row with fixed 280px-wide columns and
// overflow-x-auto on every viewport. Eight columns at equal width on a
// typical desktop would crush the cards, so we opted for a uniform
// horizontal-scroll experience rather than a responsive grid that breaks
// at one breakpoint. flex-shrink-0 is mandatory so columns keep their width.
// ---------------------------------------------------------------------------

type JobsMap = Record<string, JobCardJob[]>;

interface KanbanBoardProps {
  jobsMap: JobsMap;
  onDelete: (jobId: string) => void;
  statuses?: readonly Status[];
}

export function KanbanBoard({ jobsMap, onDelete, statuses }: KanbanBoardProps) {
  const tStatus = useTranslations("Jobs.status");
  const visible = statuses ?? STATUSES;

  return (
    <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto pb-2">
      {visible.map((status: Status) => (
        <div key={status} className="w-[280px] flex-shrink-0 h-full">
          <KanbanColumn
            status={status}
            label={tStatus(status).toUpperCase()}
            jobs={jobsMap[status] ?? []}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}
