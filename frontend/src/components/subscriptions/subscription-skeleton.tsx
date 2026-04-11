import { Skeleton } from "@/components/ui/skeleton";

export function SubscriptionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-6">
        {/* Left Column */}
        <div className="space-y-6 xl:col-span-2">
          {/* Next Payment Card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="space-y-4 border-b pb-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="space-y-4 pt-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-9 w-full" />
            </div>
          </div>

          {/* Past Payments Card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between border-b pb-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 py-5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-4">
          {/* Line Items Card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 border-b pb-5">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-56" />
            </div>
            <div className="pt-6 space-y-6">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="col-span-6 flex items-center gap-6">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between rounded-md bg-muted/60 px-3 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
