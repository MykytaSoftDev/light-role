"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  resumes: "Resumes",
  tailor: "Tailor Resume",
  jobs: "Jobs",
  settings: "Settings",
  applications: "Applications",
  profile: "Profile",
  notifications: "Notifications",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveLabel(seg: string, parentSeg: string | undefined): string {
  if (!UUID_RE.test(seg)) return SEGMENT_LABELS[seg] ?? seg;
  if (parentSeg === "resumes") return "Edit Resume";
  if (parentSeg === "jobs") return "Job Details";
  return "Details";
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't render on root dashboard page
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, idx) => ({
    label: resolveLabel(seg, segments[idx - 1]),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    isLast: idx === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, idx) => (
        <div key={crumb.href} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {crumb.isLast ? (
            <span className="font-medium text-foreground truncate max-w-[160px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
