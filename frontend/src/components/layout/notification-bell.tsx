"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryKeys } from "@/hooks/api/keys";
import { useNotifications } from "@/hooks/api/useNotifications";
import {
  markAllAsRead,
  markAsRead,
  type Notification,
  type NotificationListResponse,
} from "@/lib/notifications-api";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimeAgo(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return (isoDate: string): string => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t("justNow");
    if (minutes < 60) return t("minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("hours", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t("days", { count: days });
    return new Date(isoDate).toLocaleDateString();
  };
}

/** Map entity_type values to dashboard routes.
 *
 * `entityId` is nullable: CL-12 emits `cover_letter` notifications with a
 * null entity_id (variants weren't persisted on disconnect — option B), so
 * we route the user to the wizard fresh-start instead of an editor URL.
 */
function entityRoute(entityType: string, entityId: string | null): string | null {
  switch (entityType) {
    case "job":
    case "application":
      return entityId ? `/dashboard/jobs/${entityId}` : null;
    case "resume":
    // TAILOR-17: tailored-resume "ready" notifications produced by the
    // backgrounded tailor flow. Route to the v2 editor at the same shape as
    // the legacy `resume` type so the existing mark-as-read flow handles it.
    case "tailored_resume":
      return entityId ? `/dashboard/resumes/${entityId}` : null;
    case "cover_letter":
      // CL-12: when the user closes the tab during CL generation we drop a
      // notification with entity_id=null because variants live only in
      // wizard memory (option B). Route them back to the wizard fresh-start
      // — credit was already consumed, accepted MVP trade-off.
      return entityId
        ? `/dashboard/cover-letters/${entityId}`
        : "/dashboard/cover-letters/generate";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations("Notifications.bell");
  const tTime = useTranslations("Notifications.timeAgo");
  const timeAgo = makeTimeAgo(tTime);

  const { data } = useNotifications();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      await markAsRead(notification.id);
      // Optimistically update the cache
      queryClient.setQueryData<NotificationListResponse>(queryKeys.user.notifications, (old) => {
        if (!old) return old;
        const wasUnread = !notification.is_read;
        return {
          notifications: old.notifications.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          ),
          unread_count: wasUnread ? Math.max(0, old.unread_count - 1) : old.unread_count,
        };
      });
    } catch {
      // ignore
    }

    // entity_id is allowed to be null (CL-12: cover_letter notifications on
    // disconnect carry no entity_id because variants weren't persisted —
    // entityRoute() handles that case by routing to the wizard fresh-start).
    if (notification.entity_type) {
      const route = entityRoute(notification.entity_type, notification.entity_id);
      if (route) {
        setOpen(false);
        router.push(route);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      // Optimistically update the cache
      queryClient.setQueryData<NotificationListResponse>(queryKeys.user.notifications, (old) => {
        if (!old) return old;
        return {
          notifications: old.notifications.map((n) => ({ ...n, is_read: true })),
          unread_count: 0,
        };
      });
    } catch {
      // ignore
    }
  };

  const unreadAriaLabel =
    unreadCount > 0 ? t("unreadCountAria", { count: unreadCount }) : t("ariaLabel");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "text-foreground/70 hover:bg-accent hover:text-accent-foreground relative flex items-center justify-center rounded-md p-2 transition-colors",
            className
          )}
          aria-label={unreadAriaLabel}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t("title")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs"
              onClick={handleMarkAllAsRead}
            >
              {t("markAllRead")}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <Bell className="text-muted-foreground/40 size-8" />
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                className={cn(
                  "hover:bg-accent flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0",
                  !notification.is_read && "bg-primary/5"
                )}
                onClick={() => handleMarkAsRead(notification)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm leading-snug",
                      !notification.is_read ? "font-medium" : "text-muted-foreground"
                    )}
                  >
                    {notification.title}
                  </span>
                  {!notification.is_read && (
                    <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
                  )}
                </div>
                <p className="text-muted-foreground line-clamp-2 text-xs">{notification.message}</p>
                <span className="text-muted-foreground/70 text-[11px]">
                  {timeAgo(notification.created_at)}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
