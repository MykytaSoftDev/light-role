"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      <h2 className="mt-5 text-2xl font-bold tracking-tight">
        Something went wrong
      </h2>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try Again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
