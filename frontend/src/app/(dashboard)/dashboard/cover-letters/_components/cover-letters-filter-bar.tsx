"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export type SortValue = "newest" | "oldest" | "recently_updated";

export const DEFAULT_SORT: SortValue = "newest";

const SORT_LABELS: Record<SortValue, string> = {
  newest: "Newest",
  oldest: "Oldest",
  recently_updated: "Recently updated",
};

interface CoverLettersFilterBarProps {
  search: string;
  /** Called with the debounced (200ms) value — already stable for URL writes. */
  onSearchChange: (value: string) => void;

  sort: SortValue;
  onSortChange: (next: SortValue) => void;

  count: number;

  onClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Cover-letters list filter bar (CL-10).
 *
 * Slimmer than the resume-list filter bar — CL list page does not have a
 * Job multi-select (PRD §3.6 doesn't call for one and it would create UI
 * clutter; users searching across CLs typically know either the CL name
 * or the company they sent it to, both of which are covered by the
 * search input). If we add Job filtering later, mirror the resume bar.
 */
export function CoverLettersFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  count,
  onClearAll,
}: CoverLettersFilterBarProps) {
  // Local immediate-update value for the input; debounced upward 200ms so URL
  // writes don't fire on every keystroke. Mirrors `ResumesFilterBar`.
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

  const hasFilters = search !== "" || sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex items-center w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, company, or job…"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          aria-label="Search cover letters"
          className="h-9 pl-8 pr-8"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch("")}
            aria-label="Clear search"
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Sort */}
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortValue)}>
        <SelectTrigger
          aria-label="Sort cover letters"
          className="h-9 w-[180px]"
        >
          <SelectValue placeholder="Newest" />
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
          Clear
        </Button>
      )}

      {/* Count */}
      <span className="ml-auto text-xs text-muted-foreground">
        {count === 0
          ? hasFilters
            ? "No cover letters match your filters."
            : "No cover letters."
          : `${count} cover letter${count !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}
