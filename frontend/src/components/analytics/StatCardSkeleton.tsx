import { Skeleton } from "@/components/ui/skeleton";

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}
