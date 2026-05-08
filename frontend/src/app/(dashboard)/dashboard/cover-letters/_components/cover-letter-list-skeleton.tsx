/**
 * Skeleton placeholder for `CoverLetterCard` (CL-10).
 *
 * Rendered six-up in the same grid as the live card while the LIST query is
 * pending so the page chrome (filter bar + grid) doesn't reflow when data
 * arrives. Matches the `ResumeCardSkeleton` proportions.
 */
export function CoverLetterCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="mt-3 pl-[52px]">
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="mt-3 flex items-center gap-1.5 pl-[52px]">
        <div className="h-4 w-14 rounded bg-muted animate-pulse" />
        <div className="h-4 w-14 rounded bg-muted animate-pulse" />
        <div className="h-4 w-14 rounded bg-muted animate-pulse" />
      </div>
      <div className="mt-3 pl-[52px]">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}
