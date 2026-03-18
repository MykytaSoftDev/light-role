"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerState = "offline" | "back-online" | "hidden";

export function OfflineDetector() {
  const [bannerState, setBannerState] = useState<BannerState>("hidden");

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      setBannerState("offline");
    };

    const handleOnline = () => {
      // Only show "back online" if we were previously showing the offline banner
      setBannerState((prev) => {
        if (prev === "offline") {
          dismissTimer = setTimeout(() => setBannerState("hidden"), 3000);
          return "back-online";
        }
        return prev;
      });
    };

    // Set initial state based on current navigator status
    if (typeof window !== "undefined" && !navigator.onLine) {
      setBannerState("offline");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (bannerState === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg",
        "text-sm font-medium transition-colors",
        bannerState === "offline"
          ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/80 dark:text-orange-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
      )}
    >
      {bannerState === "offline" ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>No internet connection. Some features may not work.</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 shrink-0" />
          <span>You&apos;re back online!</span>
        </>
      )}
    </div>
  );
}
