"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type SortValue = "newest" | "oldest" | "name_asc" | "name_desc";

export const DEFAULT_SORT: SortValue = "newest";

function makeSortLabels(
  t: (key: string) => string
): Record<SortValue, string> {
  return {
    newest: t("newestFirst"),
    oldest: t("oldestFirst"),
    name_asc: t("nameAsc"),
    name_desc: t("nameDesc"),
  };
}

/**
 * Job options derived from the loaded resumes (no separate /jobs fetch).
 * Per spec §1.3 the filter dropdown source is the set of jobs that have
 * resumes — anything else would let the user select a job that yields zero
 * matches by definition.
 */
export interface JobFilterOption {
  id: string;
  /** Pre-formatted "{title}{ — {company}}" string. */
  label: string;
}

interface ResumesFilterBarProps {
  search: string;
  /** Called with the debounced (200ms) value — already stable for URL writes. */
  onSearchChange: (value: string) => void;

  jobOptions: JobFilterOption[];
  selectedJobIds: Set<string>;
  onSelectedJobsChange: (next: Set<string>) => void;

  sort: SortValue;
  onSortChange: (next: SortValue) => void;

  count: number;

  onClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResumesFilterBar({
  search,
  onSearchChange,
  jobOptions,
  selectedJobIds,
  onSelectedJobsChange,
  sort,
  onSortChange,
  count,
  onClearAll,
}: ResumesFilterBarProps) {
  const t = useTranslations("Resumes.list");
  const tSort = useTranslations("Resumes.list.sort");
  const tFilter = useTranslations("Resumes.list.filter");
  const tCommon = useTranslations("Common.actions");
  const SORT_LABELS = makeSortLabels(tSort);
  // Local immediate-update value for the input; debounced upward 200ms per
  // spec §1.3 so URL writes don't fire on every keystroke.
  const [localSearch, setLocalSearch] = useState(search);

  // Sync from external (e.g. Clear, back-button restore).
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    if (localSearch === search) return;
    const t = setTimeout(() => onSearchChange(localSearch), 200);
    return () => clearTimeout(t);
    // We intentionally exclude `search`/`onSearchChange` so a parent re-render
    // of the callback doesn't re-arm the debounce. Local input is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const toggleJob = (id: string) => {
    const next = new Set(selectedJobIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedJobsChange(next);
  };

  const selectedCount = selectedJobIds.size;
  const hasFilters =
    search !== "" || selectedCount > 0 || sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex items-center w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          aria-label={t("searchPlaceholder")}
          className="h-9 pl-8 pr-8"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch("")}
            aria-label={tCommon("clear")}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Job multi-select dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 gap-1.5",
              selectedCount > 0 && "border-primary/40 bg-primary/5 text-primary"
            )}
            disabled={jobOptions.length === 0}
          >
            <Filter className="h-3.5 w-3.5" />
            {tFilter("jobButton")}
            {selectedCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {selectedCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 min-w-[220px] overflow-y-auto"
        >
          {jobOptions.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              {tFilter("noJobs")}
            </div>
          ) : (
            <>
              {jobOptions.map((job) => {
                const checked = selectedJobIds.has(job.id);
                return (
                  <DropdownMenuItem
                    key={job.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleJob(job.id);
                    }}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border border-border transition-colors",
                        checked && "border-primary bg-primary"
                      )}
                    >
                      {checked && (
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      )}
                    </span>
                    <span className="truncate">{job.label}</span>
                  </DropdownMenuItem>
                );
              })}
              {selectedCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onSelectedJobsChange(new Set());
                    }}
                    className="cursor-pointer text-muted-foreground"
                  >
                    {tFilter("clearSelection")}
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <Select
        value={sort}
        onValueChange={(v) => onSortChange(v as SortValue)}
      >
        <SelectTrigger
          aria-label={t("sortLabel")}
          className="h-9 w-[170px]"
        >
          <SelectValue placeholder={SORT_LABELS.newest} />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortValue[]).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {SORT_LABELS[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear all */}
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          onClick={onClearAll}
          className="h-9 gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          {tCommon("clear")}
        </Button>
      )}

      {/* Count */}
      <span className="ml-auto text-xs text-muted-foreground">
        {count === 0
          ? hasFilters
            ? t("noMatches")
            : t("countNone")
          : count === 1
            ? t("countOne")
            : t("countOther", { count })}
      </span>
    </div>
  );
}
