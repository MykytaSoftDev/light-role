"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  UserSearch,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

import type { AdminUserListItem } from "@/hooks/api/useAdmin";

export type SortableField = "email" | "created_at" | "last_login_at";
export type SortOrder = "asc" | "desc";

interface AdminUsersTableProps {
  rows: AdminUserListItem[];
  isLoading: boolean;
  sortBy: SortableField;
  sortOrder: SortOrder;
  onSortChange: (field: SortableField) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const PLAN_BADGE: Record<
  string,
  { label: string; className: string; variant?: "secondary" | "outline" }
> = {
  free: { label: "Free", className: "", variant: "secondary" },
  pro: {
    label: "Pro",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  pro_annual: {
    label: "Pro Annual",
    className:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
};

function PlanBadge({
  slug,
  name,
}: {
  slug: string | null;
  name: string | null;
}) {
  if (!slug) {
    return <span className="text-muted-foreground">—</span>;
  }
  const cfg = PLAN_BADGE[slug];
  if (cfg) {
    if (cfg.variant) {
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    }
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  }
  // Unknown plan slug — render the backend's plan_name (or slug) defensively.
  return <Badge variant="outline">{name ?? slug}</Badge>;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  trialing: "bg-sky-500",
  past_due: "bg-amber-500",
  cancelled: "bg-muted-foreground/60",
  paused: "bg-muted-foreground/60",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  cancelled: "Cancelled",
  paused: "Paused",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/60"}`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function AiOpsCell({ used }: { used: number }) {
  // The list endpoint exposes only the used count, not the per-plan limit.
  // Show as plain number; the detail view has the full progress.
  return (
    <div className="flex flex-col gap-1">
      <span className="tabular-nums">{used}</span>
      <Progress value={0} className="h-1" />
    </div>
  );
}

function RelativeCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
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

function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  field: SortableField;
  label: string;
  sortBy: SortableField;
  sortOrder: SortOrder;
  onSortChange: (f: SortableField) => void;
}) {
  const active = sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onSortChange(field)}
      className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
    >
      {label}
      {!active && <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />}
      {active && sortOrder === "asc" && <ChevronUp className="h-3.5 w-3.5" />}
      {active && sortOrder === "desc" && (
        <ChevronDown className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-44" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
    </TableRow>
  );
}

export function AdminUsersTable({
  rows,
  isLoading,
  sortBy,
  sortOrder,
  onSortChange,
  onClearFilters,
  hasActiveFilters,
}: AdminUsersTableProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">
            <SortHeader
              field="email"
              label="Email"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead className="min-w-[140px]">Name</TableHead>
          <TableHead className="w-[100px]">Plan</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[120px]">AI ops</TableHead>
          <TableHead className="w-[110px]">
            <SortHeader
              field="created_at"
              label="Created"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead className="w-[110px]">
            <SortHeader
              field="last_login_at"
              label="Last login"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
          </TableHead>
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
            <TableCell colSpan={7} className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <UserSearch className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No users match your filters
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
          rows.map((u) => {
            const name =
              [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
              null;
            return (
              <TableRow
                key={u.id}
                onClick={() => router.push(DASHBOARD_PAGES.ADMIN_USER(u.id))}
                className="cursor-pointer transition-colors hover:bg-muted/40"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{u.email}</span>
                    {u.is_admin && (
                      <Badge variant="secondary" className="text-[10px]">
                        Admin
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <PlanBadge slug={u.plan_slug} name={u.plan_name} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={u.subscription_status} />
                </TableCell>
                <TableCell>
                  <AiOpsCell used={u.ai_operations_used_current_cycle} />
                </TableCell>
                <TableCell>
                  <RelativeCell iso={u.created_at} />
                </TableCell>
                <TableCell>
                  <RelativeCell iso={u.last_login_at} />
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
