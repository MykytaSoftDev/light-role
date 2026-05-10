"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: "dashboard",
  resumes: "resumes",
  tailor: "tailorResume",
  jobs: "jobs",
  settings: "settings",
  applications: "applications",
  profile: "profile",
  notifications: "notifications",
  subscriptions: "subscriptions",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^(sub|txn|ctm|pri|pro|res|job|cl)_[a-z0-9]+$/i;

function isIdSegment(seg: string) {
  return UUID_RE.test(seg) || ID_RE.test(seg);
}

export function DynamicBreadcrumb() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const t = useTranslations("DashboardShell.breadcrumb");

  // Don't render on root dashboard page
  if (segments.length <= 1) return null;

  const resolveLabel = (seg: string, parentSeg: string | undefined): string | null => {
    if (isIdSegment(seg)) {
      if (parentSeg === "subscriptions") return null;
      if (parentSeg === "resumes") return t("editResume");
      if (parentSeg === "jobs") return t("jobDetails");
      return t("details");
    }
    const key = SEGMENT_KEYS[seg];
    if (key) return t(key);
    return seg[0].toUpperCase() + seg.slice(1);
  };

  const crumbs = segments
    .map((seg, idx) => ({
      label: resolveLabel(seg, segments[idx - 1]),
      href: "/" + segments.slice(0, idx + 1).join("/"),
    }))
    .filter((c): c is { label: string; href: string } => c.label !== null)
    .map((c, idx, arr) => ({ ...c, isLast: idx === arr.length - 1 }));

  return (
    <nav aria-label={t("ariaLabel")} className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((crumb, idx) => (
        <div key={crumb.href} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />}
          {crumb.isLast ? (
            <span className="text-foreground max-w-[160px] truncate font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground max-w-[120px] truncate transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
