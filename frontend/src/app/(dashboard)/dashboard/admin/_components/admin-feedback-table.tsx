"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquareWarning,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";

import type {
  AdminFeedbackItem,
  FeedbackStatus,
  FeedbackType,
} from "@/hooks/api/useAdmin";

import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
} from "./admin-feedback-filters";

interface AdminFeedbackTableProps {
  rows: AdminFeedbackItem[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

// ── Badge styling per type ────────────────────────────────────────────────
//
// Maps to the colour hints in the task spec. `feature_request` and
// `improvement` both render in the primary tone (improvement isn't in the
// SPEC palette but the enum does include it — group it with feature_request
// for visual purposes since they're both "asks" rather than "issues").

function TypeBadge({ type }: { type: FeedbackType }) {
  const label = FEEDBACK_TYPE_LABELS[type] ?? type;
  switch (type) {
    case "bug":
      return (
        <Badge
          variant="outline"
          className="border-destructive/40 text-destructive"
        >
          {label}
        </Badge>
      );
    case "feature_request":
    case "improvement":
      return (
        <Badge variant="outline" className="border-primary/40 text-primary">
          {label}
        </Badge>
      );
    case "other":
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const label = FEEDBACK_STATUS_LABELS[status] ?? status;
  switch (status) {
    case "new":
      return <Badge variant="secondary">{label}</Badge>;
    case "reviewed":
      return <Badge variant="outline">{label}</Badge>;
    case "planned":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          {label}
        </Badge>
      );
    case "done":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
          {label}
        </Badge>
      );
    case "declined":
      return (
        <Badge
          variant="outline"
          className="text-muted-foreground border-muted-foreground/30"
        >
          {label}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

function RelativeCell({ iso }: { iso: string }) {
  const date = new Date(iso);
  const rel = formatDistanceToNow(date, { addSuffix: true });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default text-sm">{rel}</span>
      </TooltipTrigger>
      <TooltipContent>{date.toLocaleString()}</TooltipContent>
    </Tooltip>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-4" />
      </TableCell>
    </TableRow>
  );
}

function ExpandedRow({ item }: { item: AdminFeedbackItem }) {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={6} className="p-4">
        <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-md">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Full message
            </p>
            <p className="text-sm whitespace-pre-wrap">{item.message}</p>
          </div>
          {item.page_url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Submitted from
              </p>
              <code className="text-xs break-all">{item.page_url}</code>
            </div>
          )}
          {item.user_agent && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                User agent
              </p>
              <code className="text-xs text-muted-foreground break-all">
                {item.user_agent}
              </code>
            </div>
          )}
          {item.admin_notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Admin notes
              </p>
              <p className="text-sm whitespace-pre-wrap">{item.admin_notes}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" asChild>
              <Link href={DASHBOARD_PAGES.ADMIN_USER(item.user_id)}>
                View user <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminFeedbackTable({
  rows,
  isLoading,
  hasActiveFilters,
  onClearFilters,
}: AdminFeedbackTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Submitted at</TableHead>
          <TableHead className="min-w-[200px]">User</TableHead>
          <TableHead className="w-[110px]">Type</TableHead>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead>Message preview</TableHead>
          <TableHead className="w-[40px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {!isLoading && rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "No feedback matches your filters."
                    : "No feedback yet"}
                </p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isLoading &&
          rows.map((item) => {
            const isOpen = expanded.has(item.id);
            const name =
              [item.user_first_name, item.user_last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || null;
            const preview =
              item.message.length > 100
                ? `${item.message.slice(0, 100)}…`
                : item.message;
            return (
              <Fragment key={item.id}>
                <TableRow
                  onClick={() => toggleExpand(item.id)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  data-state={isOpen ? "selected" : undefined}
                >
                  <TableCell>
                    <RelativeCell iso={item.created_at} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {item.user_email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {name ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={item.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{preview}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.id);
                      }}
                      aria-label={isOpen ? "Collapse row" : "Expand row"}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
                {isOpen && <ExpandedRow item={item} />}
              </Fragment>
            );
          })}
      </TableBody>
    </Table>
  );
}
