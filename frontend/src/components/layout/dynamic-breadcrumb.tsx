"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  resumes: "Resumes",
  tailor: "Tailor Resume",
  jobs: "Jobs",
  settings: "Settings",
  applications: "Applications",
  profile: "Profile",
  notifications: "Notifications",
  subscriptions: "My Subscription",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^(sub|txn|ctm|pri|pro|res|job|cl)_[a-z0-9]+$/i;

function isIdSegment(seg: string) {
  return UUID_RE.test(seg) || ID_RE.test(seg);
}

function resolveLabel(seg: string, parentSeg: string | undefined): string | null {
  if (isIdSegment(seg)) {
    if (parentSeg === "subscriptions") return null;
    if (parentSeg === "resumes") return "Edit Resume";
    if (parentSeg === "jobs") return "Job Details";
    return "Details";
  }
  return SEGMENT_LABELS[seg] ?? seg[0].toUpperCase() + seg.slice(1);
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't render on root dashboard page
  if (segments.length <= 1) return null;

  const crumbs = segments
    .map((seg, idx) => ({
      label: resolveLabel(seg, segments[idx - 1]),
      href: "/" + segments.slice(0, idx + 1).join("/"),
    }))
    .filter((c): c is { label: string; href: string } => c.label !== null)
    .map((c, idx, arr) => ({ ...c, isLast: idx === arr.length - 1 }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
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
