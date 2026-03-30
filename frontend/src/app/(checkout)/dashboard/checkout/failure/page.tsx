"use client";

import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Link from "next/link";

const COMMON_REASONS = [
  "Insufficient funds",
  "Card declined by bank",
  "Incorrect card details",
  "Payment blocked by issuer",
];

export default function CheckoutFailurePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="animate-pulse rounded-full bg-destructive/10 p-6 dark:bg-destructive/20">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payment could not be completed
          </h1>
          <p className="text-muted-foreground">
            No charges have been made to your account.
          </p>
        </div>

        {/* Common reasons */}
        <div className="rounded-lg border border-border bg-muted/40 px-6 py-5 text-left">
          <p className="mb-3 text-sm font-medium text-foreground">
            Common reasons for payment failure:
          </p>
          <ul className="space-y-1.5">
            {COMMON_REASONS.map((reason) => (
              <li
                key={reason}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/60" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard/checkout">Try Again</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:support@lightrole.com">Contact Support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
