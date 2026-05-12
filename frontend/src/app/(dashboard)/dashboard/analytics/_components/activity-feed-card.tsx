"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityEvent } from "@/lib/types/analytics";

import { ActivityFeedItem } from "./activity-feed-item";

interface ActivityFeedCardProps {
  recentActivity: ActivityEvent[];
}

/**
 * Row 5 — full-width recent activity feed. Hidden entirely when the list is
 * empty so a fresh account doesn't render a card with just a header and a
 * "See all" link pointing nowhere useful.
 *
 * `/dashboard/activity` is a placeholder route per SPEC §5.6; the link is
 * left in so we don't have to revisit this component when that page lands.
 */
export function ActivityFeedCard({ recentActivity }: ActivityFeedCardProps) {
  const t = useTranslations("analytics");

  if (recentActivity.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-[15px] font-medium leading-none tracking-normal">
            {t("activity_title")}
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {t("activity_subtitle")}
          </CardDescription>
        </div>
        <Link
          href="/dashboard/activity"
          className="text-sm text-primary hover:underline"
        >
          {t("activity_view_all")}
        </Link>
      </CardHeader>
      <CardContent className="p-0 px-6 pb-2">
        {/* Per-item border-bottom (skipped on last) — we rely on that rather
            than wrapping in a `divide-y` so we can omit the divider after the
            last row without an explicit `:last-child` selector. */}
        {recentActivity.map((event, index) => (
          <ActivityFeedItem
            key={event.id}
            event={event}
            isLast={index === recentActivity.length - 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}
