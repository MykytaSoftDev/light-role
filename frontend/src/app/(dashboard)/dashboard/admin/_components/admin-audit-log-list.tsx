"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useAdminAuditLogs } from "@/hooks/api/useAdmin";

// Friendly humanized labels for the action enum strings. Source of truth:
// `backend/app/constants/admin_actions.py`. Anything not listed here falls
// back to a naive split of dots/underscores so the UI never shows raw
// `subscription.grant_pro` text.
const ACTION_LABELS: Record<string, string> = {
  "impersonation.start": "impersonation start",
  "impersonation.stop": "impersonation stop",
  "subscription.grant_pro": "grant pro",
  "subscription.cancel_manual": "cancel subscription",
  "subscription.reset_cycle": "reset cycle",
  "usage.reset_ai_ops": "reset AI ops",
  "user.ban": "ban user",
  "user.unban": "unban user",
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

interface AdminAuditLogListProps {
  targetUserId: string;
  pageSize?: number;
}

export function AdminAuditLogList({
  targetUserId,
  pageSize = 10,
}: AdminAuditLogListProps) {
  const query = useAdminAuditLogs({ targetUserId, pageSize });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent admin actions</CardTitle>
        {/*
         * "View all" link hidden for Phase 1 per SPEC §5.5 — Phase 2 will
         * add a dedicated audit-log page; for now the inline list is the
         * only surface.
         */}
      </CardHeader>
      <CardContent>
        {query.isLoading && (
          <ul className="flex flex-col">
            {Array.from({ length: 5 }).map((_, idx) => (
              <li
                key={idx}
                className="border-b border-border py-3 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {query.isError && !query.isLoading && (
          <p className="py-2 text-xs text-muted-foreground">
            Failed to load audit log.
          </p>
        )}

        {query.data && query.data.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <History className="h-6 w-6" />
            <p className="text-xs">No admin actions yet for this user.</p>
          </div>
        )}

        {query.data && query.data.items.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <ul className="flex flex-col">
              {query.data.items.map((item) => {
                const isOpen = expanded.has(item.id);
                const created = new Date(item.created_at);
                const hasPayload =
                  item.payload && Object.keys(item.payload).length > 0;

                return (
                  <li
                    key={item.id}
                    className="border-b border-border py-3 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="h-5 text-xs"
                          >
                            {formatActionLabel(item.action)}
                          </Badge>
                          {hasPayload && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              aria-label={
                                isOpen ? "Hide details" : "Show details"
                              }
                              aria-expanded={isOpen}
                              className="ml-auto text-muted-foreground hover:text-foreground"
                            >
                              {isOpen ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          by {item.admin_email}
                        </p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="cursor-default text-xs text-muted-foreground">
                              {formatDistanceToNow(created, {
                                addSuffix: true,
                              })}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            {created.toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                        {isOpen && hasPayload && (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                            {JSON.stringify(item.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
