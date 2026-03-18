"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  count?: number;
  className?: string;
}

export function NotificationBell({ count = 0, className }: NotificationBellProps) {
  return (
    <button
      className={cn(
        "relative flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors",
        className
      )}
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span
          className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
