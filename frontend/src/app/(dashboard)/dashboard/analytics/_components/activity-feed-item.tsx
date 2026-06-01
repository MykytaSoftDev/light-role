"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  Bookmark,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Send,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/analytics/relative-time";
import type { ActivityEvent, ActivityEventType } from "@/lib/types/analytics";

interface ActivityFeedItemProps {
  event: ActivityEvent;
  isLast: boolean;
}

// Lucide icon component type — the actual icons are forwardRef'd LucideIcon
// components, but the common-denominator props are `className` + `style`.
type IconComponent = ComponentType<{ className?: string; style?: React.CSSProperties }>;

// Event type → icon + colour CSS variable. Centralised so the same mapping
// can be reused if a future "View all" page lands.
const EVENT_VISUALS: Record<
  ActivityEventType,
  { icon: IconComponent; color: string }
> = {
  status_change_offer: { icon: Award, color: "var(--status-offer)" },
  status_change_interview: { icon: MessageCircle, color: "var(--status-interview)" },
  status_change_screening: { icon: Eye, color: "var(--status-screening)" },
  status_change_applied: { icon: Send, color: "var(--status-applied)" },
  status_change_rejected: { icon: X, color: "var(--muted-foreground)" },
  resume_tailored: { icon: FileText, color: "var(--chart-2)" },
  cover_letter_generated: { icon: Mail, color: "var(--chart-2)" },
  job_saved: { icon: Bookmark, color: "var(--muted-foreground)" },
};

// Lookup is a const map (no template-literal string keys) so that the next-intl
// type-checker can verify each key against the analytics namespace at build
// time — `t(\`activity_action_${event.type}\`)` would resolve to `string` and
// silently miss missing keys.
const ACTION_KEY: Record<ActivityEventType, string> = {
  status_change_offer: "activity_action_status_change_offer",
  status_change_interview: "activity_action_status_change_interview",
  status_change_screening: "activity_action_status_change_screening",
  status_change_applied: "activity_action_status_change_applied",
  status_change_rejected: "activity_action_status_change_rejected",
  resume_tailored: "activity_action_resume_tailored",
  cover_letter_generated: "activity_action_cover_letter_generated",
  job_saved: "activity_action_job_saved",
};

/**
 * Single row in the recent-activity feed. The icon plate uses
 * `color-mix(in oklch, ...)` to render a tinted background derived from the
 * full-saturation icon colour — same trick as the mockup.
 *
 * The title is built client-side from the new structured fields (`type`,
 * `company`, `role`) so that switching the UI language re-renders the feed
 * without a refetch. The legacy `event.title` / `event.meta` fields are
 * Russian-hardcoded on the backend and are deliberately ignored.
 *
 * Layout: `<action verb> · <strong>{company}</strong> — {role}`
 *  - company missing → just the action verb
 *  - role missing    → `<verb> · <strong>{company}</strong>`
 */
export function ActivityFeedItem({ event, isLast }: ActivityFeedItemProps) {
  const t = useTranslations("analytics");
  const visuals = EVENT_VISUALS[event.type];
  // Defensive fallback — if the backend invents a new ActivityEventType we
  // haven't mapped yet, render the row with the same muted treatment as
  // job_saved instead of crashing.
  const Icon = visuals?.icon ?? Bookmark;
  const color = visuals?.color ?? "var(--muted-foreground)";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const action = t(ACTION_KEY[event.type] as any);

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-3",
        !isLast && "border-b border-border/50"
      )}
    >
      {/* Icon plate */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{
          background: `color-mix(in oklch, ${color} 15%, transparent)`,
        }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>

      {/* Title — built in JSX so company stays bold without dangerouslySetInnerHTML */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight">
          {event.company && event.role ? (
            <>
              {action} · <strong className="font-medium">{event.company}</strong>, {event.role}
            </>
          ) : event.company ? (
            <>
              {action} · <strong className="font-medium">{event.company}</strong>
            </>
          ) : (
            action
          )}
        </p>
      </div>

      {/* Relative time */}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
        {formatRelativeTime(event.occurred_at, t)}
      </span>
    </div>
  );
}
