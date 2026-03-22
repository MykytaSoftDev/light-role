"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/lib/notifications-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

/** Map entity_type values to dashboard routes. */
function entityRoute(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "job":
    case "application":
      return `/dashboard/jobs/${entityId}`;
    case "resume":
      return `/dashboard/resumes/${entityId}`;
    case "cover_letter":
      return `/dashboard/cover-letters/${entityId}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently fail — user may not be logged in yet or network hiccup
    }
  }, []);

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - (notification.is_read ? 0 : 1)));
    } catch {
      // ignore
    }

    if (notification.entity_type && notification.entity_id) {
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
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors",
            className
          )}
          aria-label={
            unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"
          }
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <Bell className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                className={cn(
                  "flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
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
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {notification.message}
                </p>
                <span className="text-[11px] text-muted-foreground/70">
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
