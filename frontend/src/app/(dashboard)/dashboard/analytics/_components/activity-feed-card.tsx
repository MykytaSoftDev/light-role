"use client";

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

export function ActivityFeedCard({ recentActivity }: ActivityFeedCardProps) {
  const t = useTranslations("analytics");

  if (recentActivity.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-[15px] font-medium leading-none tracking-normal">
          {t("activity_title")}
        </CardTitle>
        <CardDescription className="mt-1 text-xs">
          {t("activity_subtitle")}
        </CardDescription>
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
