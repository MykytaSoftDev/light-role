"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FeedbackStatus, FeedbackType } from "@/hooks/api/useAdmin";

// Shared humanizers — also used by the table for the badge labels. The enum
// keys come directly from `backend/app/models/enums.py`, so any change there
// needs to land both here and in the badge maps in `admin-feedback-table.tsx`.
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  feature_request: "Feature request",
  improvement: "Improvement",
  other: "Other",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  planned: "Planned",
  done: "Done",
  declined: "Declined",
};

interface AdminFeedbackFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  total?: number;
}

export function AdminFeedbackFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  pageSize,
  onPageSizeChange,
  total,
}: AdminFeedbackFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by user email or name…"
          className="h-9 pl-8 pr-8"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((k) => (
            <SelectItem key={k} value={k}>
              {FEEDBACK_TYPE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((k) => (
            <SelectItem key={k} value={k}>
              {FEEDBACK_STATUS_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        {typeof total === "number" && (
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        )}
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">per page</span>
      </div>
    </div>
  );
}
