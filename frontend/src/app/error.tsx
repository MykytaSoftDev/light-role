"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error tracking service in production
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        Something went wrong
      </h1>

      <p className="mt-3 max-w-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try Again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
