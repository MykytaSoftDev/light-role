"use client";

import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CircleCheck, CircleX, MailWarning } from "lucide-react";

type VerifyState = "loading" | "success" | "error" | "no-token";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>(token ? "loading" : "no-token");

  useEffect(() => {
    if (!token) {
      setState("no-token");
      return;
    }

    let cancelled = false;

    api
      .post("/api/v1/auth/verify-email", { token })
      .then((res) => {
        if (cancelled) return;
        if (res.ok || res.status === 200) {
          setState("success");
          router.replace("/dashboard");
        } else {
          setState("error");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <h1 className="text-2xl font-semibold">Verifying your email</h1>
          <p className="text-muted-foreground mt-2 text-sm">Just a moment...</p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <CircleCheck className="mx-auto mb-4 h-8 w-8 text-emerald-500" />
          <h1 className="text-2xl font-semibold">Email verified</h1>
          <p className="text-muted-foreground mt-2 text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <CircleX className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <h1 className="text-2xl font-semibold">Verification failed</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This link has expired or is invalid.
          </p>
          <Link
            href="/auth/register"
            className="text-primary hover:text-primary/80 mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Back to register
          </Link>
        </div>
      </div>
    );
  }

  // no-token state
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <MailWarning className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">No verification link</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          No verification token was found. Check your email for the verification link.
        </p>
        <Link
          href="/auth/login"
          className="text-primary hover:text-primary/80 mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
