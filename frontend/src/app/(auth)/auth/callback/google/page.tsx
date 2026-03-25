"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://dev-api.lightrole.com";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received from Google.");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback/google`;

    fetch(`${BASE_URL}/api/v1/auth/oauth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.detail || "Sign in with Google failed.");
          });
        }
        router.push("/dashboard");
      })
      .catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Link
          href="/auth/login"
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return <p className="text-muted-foreground text-center text-sm">Completing sign in&hellip;</p>;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-center text-sm">Loading&hellip;</p>}
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
