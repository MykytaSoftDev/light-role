/**
 * TAILOR-8 — Skeleton loading state that mimics the editor layout.
 * Spec §3.9.
 */
export function EditorShellSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-80 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Body grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px]">
        <div className="h-[800px] animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
