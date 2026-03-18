import { cn } from "@/lib/utils";

interface SkeletonListProps {
  count?: number;
  variant?: "card" | "row";
  className?: string;
}

export function SkeletonList({
  count = 5,
  variant = "row",
  className,
}: SkeletonListProps) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          className
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border px-4 py-3"
        >
          {/* Leading block */}
          <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />
          {/* Primary text */}
          <div className="h-4 flex-1 max-w-[200px] rounded bg-muted animate-pulse" />
          {/* Secondary text */}
          <div className="h-4 w-24 rounded bg-muted animate-pulse hidden sm:block" />
          {/* Trailing block */}
          <div className="h-4 w-16 rounded bg-muted animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}
