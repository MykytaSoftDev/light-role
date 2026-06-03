"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://dev-api.lightrole.com";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Auth.googleCallback");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams?.get("code") ?? null;
    const state = searchParams?.get("state") ?? null;
    if (!code) {
      setError(t("noCode"));
      return;
    }
    // The backend validates `state` against the httpOnly `g_oauth_state` cookie.
    // A missing `state` can never validate, so fail with the generic error.
    if (!state) {
      setError(t("errorDescription"));
      return;
    }

    // credentials: "include" is REQUIRED so the `g_oauth_state` cookie is sent
    // back. The backend pins its own redirect_uri and no longer accepts one.
    fetch(`${BASE_URL}/api/v1/auth/oauth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, state }),
    })
      .then((res) => {
        if (!res.ok) {
          // Backend returns 400 for invalid/expired state or identity token.
          // Surface a generic, translated "sign-in failed" message instead of
          // leaking backend detail strings.
          throw new Error(t("errorDescription"));
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
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-center text-sm">{t("loadingTitle")}</p>
  );
}

function GoogleCallbackFallback() {
  const t = useTranslations("Auth.googleCallback");
  return <p className="text-muted-foreground text-center text-sm">{t("fallbackLoading")}</p>;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<GoogleCallbackFallback />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
