"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
  defaultDropAnimationSideEffects,
  MeasuringStrategy,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutGrid,
  Table2,
  Plus,
  Star,
  Sparkles,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  Check,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api/keys";
import { JobContextMenu } from "@/components/jobs/job-context-menu";
import { EmptyState } from "@/components/shared/empty-state";

// ---------------------------------------------------------------------------
// Types
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

interface Job {
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

type JobsMap = Record<string, Job[]>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

type Status = (typeof STATUSES)[number];

const COLUMN_COLORS: Record<Status, string> = {
  saved: "bg-slate-500",
  applied: "bg-blue-500",
  screening: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-emerald-500",
  accepted: "bg-green-600",
  rejected: "bg-red-500",
  withdrawn: "bg-gray-400",
};

// Badge colors for table status pills (bg + text pairs)
const STATUS_BADGE: Record<
  Status,
  { bg: string; text: string; dot: string }
> = {
  saved: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  applied: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  screening: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  interview: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  offer: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  accepted: {
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    dot: "bg-green-600",
  },
  rejected: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  withdrawn: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// DnD ARIA live announcements — built inside the component via
// `useDndAnnouncements` so screen reader strings can be translated.
// ---------------------------------------------------------------------------

function useDndAnnouncements() {
  const t = useTranslations("Jobs.list.dnd");
  return useMemo(
    () => ({
      onDragStart: ({ active }: { active: { id: string | number } }) =>
        t("pickedUp", { id: String(active.id) }),
      onDragOver: ({
        active,
        over,
      }: {
        active: { id: string | number };
        over: { id: string | number } | null;
      }) =>
        over
          ? t("overTarget", { id: String(active.id), overId: String(over.id) })
          : t("leftDroppable", { id: String(active.id) }),
      onDragEnd: ({
        active,
        over,
      }: {
        active: { id: string | number };
        over: { id: string | number } | null;
      }) =>
        over
          ? t("droppedOver", { id: String(active.id), overId: String(over.id) })
          : t("dropped", { id: String(active.id) }),
      onDragCancel: ({ active }: { active: { id: string | number } }) =>
        t("cancelled", { id: String(active.id) }),
    }),
    [t],
  );
}

// ---------------------------------------------------------------------------
// Sort config
// ---------------------------------------------------------------------------

type SortColumn =
  | "title"
  | "company"
  | "location"
  | "salary"
  | "status"
  | "date_saved"
  | "date_applied"
  | "deadline"
  | "follow_up"
  | "excitement";

interface SortConfig {
  column: SortColumn;
  direction: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByStatus(jobs: Job[]): JobsMap {
  const map: JobsMap = {};
  for (const status of STATUSES) {
    map[status] = [];
  }
  for (const job of jobs) {
    const s = job.application.status;
    if (map[s]) {
      map[s].push(job);
    } else {
      map[s] = [job];
    }
  }
  return map;
}

function flattenJobsMap(jobsMap: JobsMap): Job[] {
  const jobs: Job[] = [];
  for (const status of STATUSES) {
    for (const job of jobsMap[status] ?? []) {
      jobs.push(job);
    }
  }
  return jobs;
}

// Resolves which Status section a draggable id belongs to.
// - If `id` is itself a Status string, returns it directly (droppable container id).
// - Otherwise treats `id` as a Job UUID and searches each section.
function findContainer(id: string, map: JobsMap): Status | null {
  if ((STATUSES as readonly string[]).includes(id)) return id as Status;
  for (const status of STATUSES) {
    if (map[status].some((j) => j.id === id)) return status;
  }
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function compareDates(a: string | null, b: string | null, dir: "asc" | "desc"): number {
  if (!a && !b) return 0;
  if (!a) return dir === "asc" ? 1 : -1;
  if (!b) return dir === "asc" ? -1 : 1;
  const diff = new Date(a).getTime() - new Date(b).getTime();
  return dir === "asc" ? diff : -diff;
}

function compareStrings(a: string | null, b: string | null, dir: "asc" | "desc"): number {
  const aStr = a ?? "";
  const bStr = b ?? "";
  const cmp = aStr.localeCompare(bStr);
  return dir === "asc" ? cmp : -cmp;
}

function sortJobs(jobs: Job[], sort: SortConfig): Job[] {
  return [...jobs].sort((a, b) => {
    const { column, direction } = sort;
    switch (column) {
      case "title":
        return compareStrings(a.title, b.title, direction);
      case "company":
        return compareStrings(a.company, b.company, direction);
      case "location":
        return compareStrings(a.location, b.location, direction);
      case "salary":
        return compareStrings(a.salary, b.salary, direction);
      case "status":
        return compareStrings(a.application.status, b.application.status, direction);
      case "date_saved":
        return compareDates(a.created_at, b.created_at, direction);
      case "date_applied":
        return compareDates(a.application.date_applied, b.application.date_applied, direction);
      case "deadline":
        return compareDates(a.application.deadline, b.application.deadline, direction);
      case "follow_up":
        return compareDates(a.application.follow_up_date, b.application.follow_up_date, direction);
      case "excitement": {
        const aVal = a.application.excitement_level ?? 0;
        const bVal = b.application.excitement_level ?? 0;
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      default:
        return 0;
    }
  });
}

// ---------------------------------------------------------------------------
// ExcitementStars
// ---------------------------------------------------------------------------

function ExcitementStars({ level }: { level: number | null }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const count = Math.min(Math.max(level, 1), 5);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < count
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const tStatus = useTranslations("Jobs.status");
  const s = status as Status;
  const colors = STATUS_BADGE[s] ?? {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  };
  // Fall back to capitalized raw status if not a known Status (defensive).
  const label = (STATUSES as readonly string[]).includes(status)
    ? tStatus(s)
    : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// JobCardPresentation — pure visual card (no DnD wiring)
// ---------------------------------------------------------------------------

interface JobCardPresentationProps {
  job: Job;
  isDragging?: boolean;
  onDelete: (jobId: string) => void;
}

function JobCardPresentation({
  job,
  isDragging = false,
  onDelete,
}: JobCardPresentationProps) {
  const t = useTranslations("Jobs.list");
  return (
    <div
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm select-none",
        "transition-shadow duration-150",
        isDragging && "shadow-lg ring-2 ring-primary/30 rotate-1"
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/dashboard/jobs/${job.id}`}
          className="flex-1 font-semibold text-sm leading-snug hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {job.title}
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

      {/* Company */}
      <p className="mt-0.5 text-xs text-muted-foreground truncate">
        {job.company}
      </p>

      {/* Footer row */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDateShort(job.created_at)}
        </span>
        <div className="flex items-center gap-1.5">
          {job.is_ai_parsed && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          <ExcitementStars level={job.application.excitement_level} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobCard (Kanban) — wraps presentation in a useSortable for @dnd-kit.
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: Job;
  onDelete: (jobId: string) => void;
}

function JobCard({ job, onDelete }: JobCardProps) {
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
    // The DragOverlay shows the clone — hide the original to avoid double cards.
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCardPresentation job={job} onDelete={onDelete} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanSection — vertical collapsible section replacing KanbanColumn
// ---------------------------------------------------------------------------

interface KanbanSectionProps {
  status: Status;
  jobs: Job[];
  onDelete: (jobId: string) => void;
  collapsed: boolean;
  onToggleCollapse: (status: Status) => void;
}

function KanbanSection({
  status,
  jobs,
  onDelete,
  collapsed,
  onToggleCollapse,
}: KanbanSectionProps) {
  const tStatus = useTranslations("Jobs.status");
  const tList = useTranslations("Jobs.list");
  const dotColor = COLUMN_COLORS[status];
  const label = tStatus(status).toUpperCase();

  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center gap-3">
        {/* Left: dot + label + count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotColor)} />
          <span className="text-xs font-semibold tracking-widest text-foreground">
            {label}
          </span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
            {jobs.length}
          </span>
        </div>

        {/* Separator line */}
        <div className="flex-1 h-px bg-border" />

        {/* Collapse/expand chevron */}
        <button
          onClick={() => onToggleCollapse(status)}
          aria-label={
            collapsed
              ? tList("expandSectionAria", { label })
              : tList("collapseSectionAria", { label })
          }
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none"
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Card grid (expanded) or collapsed drop placeholder */}
      <div
        className={cn(
          "mt-3 transition-colors duration-150",
          collapsed && "mt-0"
        )}
      >
        {!collapsed && (
          <SortableContext
            id={status}
            items={jobs.map((j) => j.id)}
            strategy={rectSortingStrategy}
          >
            <div
              ref={setNodeRef}
              className={cn(
                "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                jobs.length === 0 && "min-h-[80px]",
                isOver && "rounded-lg bg-muted/50 p-2"
              )}
            >
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onDelete={onDelete} />
              ))}
              {/* Drop zone placeholder — always rendered when section is empty
                  so the droppable rect doesn't collapse when isOver flips on
                  hover (which would create a flicker loop and prevent drop). */}
              {jobs.length === 0 && (
                <div
                  className={cn(
                    "col-span-full flex items-center justify-center rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground min-h-[60px] transition-colors",
                    isOver
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-border"
                  )}
                >
                  {tList("dropJobsHere")}
                </div>
              )}
            </div>
          </SortableContext>
        )}

        {/* Collapsed: minimal droppable so drags can still target this status. */}
        {collapsed && (
          <div
            ref={setNodeRef}
            className={cn(
              "mt-1 rounded-lg border border-dashed border-transparent min-h-[4px] transition-all duration-150",
              isOver &&
                "min-h-[60px] border-border bg-muted/50 flex items-center justify-center mt-2"
            )}
          >
            {isOver && (
              <span className="text-xs text-muted-foreground">
                {tList("dropHere")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort header button
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  column: SortColumn;
  sort: SortConfig;
  onSort: (col: SortColumn) => void;
  className?: string;
}

function SortHeader({ label, column, sort, onSort, className }: SortHeaderProps) {
  const isActive = sort.column === column;
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap select-none",
        className
      )}
    >
      <button
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground",
          isActive && "text-foreground"
        )}
      >
        {label}
        {isActive ? (
          sort.direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Status multi-select filter dropdown
// ---------------------------------------------------------------------------

interface StatusFilterProps {
  selected: Set<Status>;
  onChange: (next: Set<Status>) => void;
}

function StatusFilterDropdown({ selected, onChange }: StatusFilterProps) {
  const tList = useTranslations("Jobs.list");
  const tStatus = useTranslations("Jobs.status");
  const toggleStatus = (s: Status) => {
    const next = new Set(selected);
    if (next.has(s)) {
      next.delete(s);
    } else {
      next.add(s);
    }
    onChange(next);
  };

  const count = selected.size;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none",
            count > 0 && "border-primary/40 bg-primary/5 text-primary"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          {tList("statusFilterLabel")}
          {count > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          sideOffset={4}
          align="start"
        >
          {STATUSES.map((s) => {
            const checked = selected.has(s);
            const badge = STATUS_BADGE[s];
            return (
              <DropdownMenu.Item
                key={s}
                className="flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onSelect={(e) => {
                  e.preventDefault();
                  toggleStatus(s);
                }}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border border-border transition-colors",
                    checked && "border-primary bg-primary"
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </span>
                <span className={cn("h-2 w-2 rounded-full", badge.dot)} />
                <span>{tStatus(s)}</span>
              </DropdownMenu.Item>
            );
          })}

          {selected.size > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground"
                onSelect={(e) => {
                  e.preventDefault();
                  onChange(new Set());
                }}
              >
                {tList("clearSelection")}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

interface TableViewProps {
  jobs: Job[];
  onDelete: (jobId: string) => void;
}

function TableView({ jobs, onDelete }: TableViewProps) {
  const router = useRouter();
  const tList = useTranslations("Jobs.list");
  const [sort, setSort] = useState<SortConfig>({
    column: "date_saved",
    direction: "desc",
  });
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set());
  const [search, setSearch] = useState("");

  const handleSort = (col: SortColumn) => {
    setSort((prev) =>
      prev.column === col
        ? { column: col, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column: col, direction: "asc" }
    );
  };

  const hasFilters = statusFilter.size > 0 || search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter(new Set());
    setSearch("");
  };

  const filtered = useMemo(() => {
    let result = jobs;
    if (statusFilter.size > 0) {
      result = result.filter((j) =>
        statusFilter.has(j.application.status as Status)
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((j) => j.company.toLowerCase().includes(q));
    }
    return sortJobs(result, sort);
  }, [jobs, statusFilter, search, sort]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={tList("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-52 rounded-lg border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              aria-label={tList("clearSearchAria")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <StatusFilterDropdown
          selected={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Clear all filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            {tList("clearFilters")}
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-xs text-muted-foreground">
          {tList("resultCount", { count: filtered.length })}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <SortHeader label={tList("columns.title")} column="title" sort={sort} onSort={handleSort} />
              <SortHeader label={tList("columns.company")} column="company" sort={sort} onSort={handleSort} />
              <SortHeader
                label={tList("columns.location")}
                column="location"
                sort={sort}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
              <SortHeader
                label={tList("columns.salary")}
                column="salary"
                sort={sort}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
              <SortHeader label={tList("columns.status")} column="status" sort={sort} onSort={handleSort} />
              <SortHeader label={tList("columns.dateSaved")} column="date_saved" sort={sort} onSort={handleSort} />
              <SortHeader label={tList("columns.dateApplied")} column="date_applied" sort={sort} onSort={handleSort} />
              <SortHeader label={tList("columns.deadline")} column="deadline" sort={sort} onSort={handleSort} />
              <SortHeader
                label={tList("columns.followUp")}
                column="follow_up"
                sort={sort}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
              <SortHeader label={tList("columns.excitement")} column="excitement" sort={sort} onSort={handleSort} />
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {tList("columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-12 text-center text-sm text-muted-foreground"
                >
                  {hasFilters
                    ? tList("emptyFiltered")
                    : tList("emptyTableRow")}
                </td>
              </tr>
            ) : (
              filtered.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                  className="group cursor-pointer transition-colors hover:bg-muted/40"
                >
                  {/* Job Position */}
                  <td className="px-3 py-2.5 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      {job.is_ai_parsed && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <span className="line-clamp-1">{job.company}</span>
                  </td>

                  {/* Location */}
                  <td className="hidden sm:table-cell px-3 py-2.5 text-muted-foreground">
                    {job.location ?? "—"}
                  </td>

                  {/* Salary */}
                  <td className="hidden sm:table-cell px-3 py-2.5 text-muted-foreground">
                    {job.salary ?? "—"}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <StatusBadge status={job.application.status} />
                  </td>

                  {/* Date Saved */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(job.created_at)}
                  </td>

                  {/* Date Applied */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(job.application.date_applied)}
                  </td>

                  {/* Deadline */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(job.application.deadline)}
                  </td>

                  {/* Follow-up */}
                  <td className="hidden sm:table-cell px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(job.application.follow_up_date)}
                  </td>

                  {/* Excitement */}
                  <td className="px-3 py-2.5">
                    <ExcitementStars level={job.application.excitement_level} />
                  </td>

                  {/* Actions */}
                  <td
                    className="px-3 py-2.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <JobContextMenu
                      job={job}
                      onDelete={onDelete}
                      trigger={
                        <button
                          className="rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted focus:opacity-100 focus:outline-none"
                          aria-label={tList("openJobMenuAria")}
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading states
// ---------------------------------------------------------------------------

function KanbanSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {STATUSES.slice(0, 4).map((status) => (
        <div key={status} className="flex flex-col gap-3">
          {/* Section header skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 animate-pulse shrink-0" />
            <div className="h-3 w-20 rounded bg-muted-foreground/30 animate-pulse shrink-0" />
            <div className="h-5 w-6 rounded-full bg-muted-foreground/20 animate-pulse shrink-0" />
            <div className="flex-1 h-px bg-border" />
          </div>
          {/* Card grid skeleton */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[84px] rounded-lg bg-muted-foreground/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  const tList = useTranslations("Jobs.list");
  const columns = [
    tList("columns.title"),
    tList("columns.company"),
    tList("columns.location"),
    tList("columns.salary"),
    tList("columns.status"),
    tList("columns.dateSaved"),
    tList("columns.dateApplied"),
    tList("columns.deadline"),
    tList("columns.followUp"),
    tList("columns.excitement"),
    tList("columns.actions"),
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: 11 }).map((__, j) => (
                <td key={j} className="px-3 py-3">
                  <div className="h-4 w-full max-w-[120px] rounded bg-muted-foreground/10 animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error toast banner
// ---------------------------------------------------------------------------

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const tList = useTranslations("Jobs.list");
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shadow-lg dark:border-red-800 dark:bg-red-950/70">
      <span className="text-sm font-medium text-red-700 dark:text-red-300">
        {message}
      </span>
      <button
        onClick={onDismiss}
        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 text-xs font-semibold"
      >
        {tList("dismiss")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DragOverlay drop animation — slight overshoot via cubic-bezier > 1 for a
// playful settle. Active item fades to 0.4 during the drop tween so the
// landing spot is visually obvious. Module scope — value is stable.
// ---------------------------------------------------------------------------

const dropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type ViewMode = "kanban" | "table";

export default function JobsPage() {
  const tList = useTranslations("Jobs.list");
  const tCommon = useTranslations("Common.toast");
  const announcements = useDndAnnouncements();
  const [jobsMap, setJobsMap] = useState<JobsMap>(() => {
    const map: JobsMap = {};
    for (const s of STATUSES) map[s] = [];
    return map;
  });
  const [dndError, setDndError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("jobsView");
      if (stored === "kanban" || stored === "table") return stored;
    }
    return "kanban";
  });

  // Kanban-specific UI state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showEmpty, setShowEmpty] = useState(true);

  // DnD state
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  // Snapshot of jobsMap captured at drag start; consumed by handleDragEnd /
  // handleDragCancel to roll back the optimistic cross-section move applied
  // in handleDragOver if the drop is invalid or the backend PATCH fails.
  const [preDragSnapshot, setPreDragSnapshot] = useState<JobsMap | null>(null);

  // Sensors: pointer requires 5px of movement before drag starts so that
  // clicking the card (to navigate) and clicking the context menu trigger
  // both still work as clicks. Keyboard sensor uses sortable's coordinate
  // getter so arrow keys move between sortable items.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Collision detection: prefer pointerWithin (drop where the pointer is),
  // falling back to rectIntersection when the pointer is outside every
  // droppable. closestCorners was previously misrouting drops on full-width
  // sections to the section that owned the source card whenever the overlay
  // sat near the horizontal center, because corner distances were nearly
  // equal across vertically-stacked sections.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  // Fetch jobs via TanStack Query (shared cache key with useJobs hook)
  const {
    data: jobsData,
    isPending: loading,
    isError,
  } = useQuery<{ items: Job[] }>({
    queryKey: queryKeys.jobs.list({}),
    queryFn: async () => {
      const res = await api.get("/api/v1/jobs?limit=100");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  // Sync server data into jobsMap (used as local DnD state)
  useEffect(() => {
    if (jobsData?.items) {
      setJobsMap(groupByStatus(jobsData.items));
    }
  }, [jobsData]);

  // Derive flat array from jobsMap — single source of truth for DnD state
  const allJobs = useMemo(() => flattenJobsMap(jobsMap), [jobsMap]);

  // Surface fetch error via the same error banner used for DnD errors
  const error = isError ? tCommon("loadError") : dndError;

  // Persist view mode
  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("jobsView", mode);
    }
  };

  // Toggle collapse for a single section
  const toggleCollapse = useCallback((status: Status) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // DnD handlers (Phase 3: DND-006/007/008).
  //
  //   handleDragStart  — locates the dragged Job, sets the DragOverlay subject,
  //                      and snapshots jobsMap for potential rollback.
  //   handleDragOver   — applies optimistic cross-section moves to jobsMap so
  //                      @dnd-kit animates the reflow between renders. Also
  //                      auto-expands a collapsed destination section.
  //   handleDragEnd    — same-section: arrayMove reorder (no backend call).
  //                      cross-section: PATCH the application status; rollback
  //                      to preDragSnapshot on failure.
  //   handleDragCancel — rolls back to preDragSnapshot and clears DnD state.
  //
  // Note: handlers are NOT wrapped in useCallback. DndContext re-binds its
  // listeners every render anyway, and the handlers must read fresh state
  // (jobsMap, preDragSnapshot) directly from the component closure.
  // -------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string;
    const container = findContainer(activeId, jobsMap);
    const found = container
      ? jobsMap[container].find((j) => j.id === activeId) ?? null
      : null;
    setActiveJob(found);
    setPreDragSnapshot(jobsMap);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setJobsMap((prev) => {
      const activeContainer = findContainer(activeId, prev);
      const overContainer = findContainer(overId, prev);
      if (!activeContainer || !overContainer) return prev;
      // Intra-section moves are deferred to handleDragEnd so we don't fight
      // with the SortableContext's own animated reorder during drag.
      if (activeContainer === overContainer) return prev;

      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((j) => j.id === activeId);
      if (activeIndex === -1) return prev;

      // If we're hovering the section container itself (overId === Status),
      // findIndex returns -1 → append to end.
      const overIndex = overItems.findIndex((j) => j.id === overId);
      const insertIndex = overIndex === -1 ? overItems.length : overIndex;

      const movedJob = activeItems[activeIndex];
      return {
        ...prev,
        [activeContainer]: activeItems.filter((_, i) => i !== activeIndex),
        [overContainer]: [
          ...overItems.slice(0, insertIndex),
          {
            ...movedJob,
            application: { ...movedJob.application, status: overContainer },
          },
          ...overItems.slice(insertIndex),
        ],
      };
    });

    // Auto-expand the destination section if it was collapsed. Outer check
    // is a perf optimization; the inner setter is functional so it's safe.
    const overContainer = findContainer(overId, jobsMap);
    if (overContainer && collapsedSections.has(overContainer)) {
      setCollapsedSections((prev) => {
        if (!prev.has(overContainer)) return prev;
        const next = new Set(prev);
        next.delete(overContainer);
        return next;
      });
    }
  }

  function handleDragCancel() {
    if (preDragSnapshot) setJobsMap(preDragSnapshot);
    setActiveJob(null);
    setPreDragSnapshot(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const startContainer = preDragSnapshot
      ? findContainer(active.id as string, preDragSnapshot)
      : null;

    // Drop outside any droppable: roll back the optimistic move.
    if (!over) {
      if (preDragSnapshot) setJobsMap(preDragSnapshot);
      setActiveJob(null);
      setPreDragSnapshot(null);
      return;
    }

    const finalContainer = findContainer(active.id as string, jobsMap);

    // Failsafe — should not happen if state is consistent.
    if (!startContainer || !finalContainer) {
      setActiveJob(null);
      setPreDragSnapshot(null);
      return;
    }

    // Same section: intra-section reorder via arrayMove (no backend call —
    // server doesn't persist within-column ordering today).
    if (startContainer === finalContainer) {
      const overId = over.id as string;
      if (overId !== active.id) {
        setJobsMap((prev) => {
          const items = prev[finalContainer];
          const oldIndex = items.findIndex((j) => j.id === active.id);
          const newIndex = items.findIndex((j) => j.id === overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return prev;
          }
          return {
            ...prev,
            [finalContainer]: arrayMove(items, oldIndex, newIndex),
          };
        });
      }
      setActiveJob(null);
      setPreDragSnapshot(null);
      return;
    }

    // Cross-section: handleDragOver has already applied the optimistic move.
    // Now persist to backend, rolling back on failure.
    const movedJob = jobsMap[finalContainer].find((j) => j.id === active.id);
    const snapshot = preDragSnapshot;
    setActiveJob(null);
    setPreDragSnapshot(null);

    if (!movedJob) return;

    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/applications/${movedJob.application.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: finalContainer }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      if (snapshot) setJobsMap(snapshot);
      setDndError(tList("statusUpdateFailed"));
    }
  }

  // Delete handler — called by JobContextMenu after a successful DELETE request.
  const handleDelete = useCallback((jobId: string) => {
    setJobsMap((prev) => {
      const next: JobsMap = {};
      for (const s of STATUSES) {
        next[s] = prev[s].filter((j) => j.id !== jobId);
      }
      return next;
    });
  }, []);

  const totalJobs = STATUSES.reduce((sum, s) => sum + jobsMap[s].length, 0);

  // While a drag is in progress, force-show empty sections so the user can
  // drop into them. MeasuringStrategy.Always on DndContext picks up the
  // newly-mounted droppables on the next frame so they become valid targets.
  const isDragging = activeJob !== null;
  const effectiveShowEmpty = showEmpty || isDragging;
  const visibleStatuses = effectiveShowEmpty
    ? STATUSES
    : STATUSES.filter((s) => jobsMap[s].length > 0);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{tList("heading")}</h1>
        <div className="flex items-center gap-2">
          {/* Show/hide empty toggle (kanban only) */}
          {viewMode === "kanban" && (
            <button
              onClick={() => setShowEmpty((v) => !v)}
              aria-label={
                showEmpty
                  ? tList("hideEmptySectionsAria")
                  : tList("showEmptySectionsAria")
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none",
                showEmpty && "border-primary/40 bg-primary/5 text-primary"
              )}
            >
              {showEmpty ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {showEmpty ? tList("hideEmpty") : tList("showEmpty")}
              </span>
            </button>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              aria-label={tList("kanbanViewAria")}
              onClick={() => switchView("kanban")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "kanban"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              aria-label={tList("tableViewAria")}
              onClick={() => switchView("table")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>

          <Link
            href="/dashboard/jobs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {tList("addJob")}
          </Link>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        viewMode === "table" ? (
          <TableSkeleton />
        ) : (
          <KanbanSkeleton />
        )
      ) : viewMode === "table" ? (
        totalJobs === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30">
            <EmptyState
              icon={<Table2 className="h-8 w-8" />}
              title={tList("empty.title")}
              description={tList("empty.description")}
              action={{
                label: tList("empty.cta"),
                href: "/dashboard/jobs/new",
              }}
            />
          </div>
        ) : (
          <TableView jobs={allJobs} onDelete={handleDelete} />
        )
      ) : totalJobs === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30">
          <EmptyState
            icon={<LayoutGrid className="h-8 w-8" />}
            title={tList("empty.title")}
            description={tList("empty.description")}
            action={{
              label: tList("empty.cta"),
              href: "/dashboard/jobs/new",
            }}
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          measuring={{
            droppable: { strategy: MeasuringStrategy.Always },
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{ announcements }}
        >
          <div className="flex flex-col gap-6">
            {visibleStatuses.map((status) => (
              <KanbanSection
                key={status}
                status={status}
                jobs={jobsMap[status]}
                onDelete={handleDelete}
                collapsed={collapsedSections.has(status)}
                onToggleCollapse={toggleCollapse}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeJob ? (
              <JobCardPresentation
                job={activeJob}
                isDragging
                onDelete={handleDelete}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Error banner */}
      {error && (
        <ErrorBanner message={error} onDismiss={() => setDndError(null)} />
      )}
    </div>
  );
}
