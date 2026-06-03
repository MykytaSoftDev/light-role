import type { Dispatch, SetStateAction } from "react";

import { api } from "@/lib/api";

/**
 * Kicks off the Google OAuth flow.
 *
 * Backend owns the Google OAuth flow: it sets an httpOnly `g_oauth_state`
 * cookie (state + PKCE) and returns the authorize URL with a pinned
 * redirect_uri. The shared `api` helper sends credentials so the cookie is
 * stored, after which we hard-navigate the browser to the authorize URL.
 *
 * On failure the relevant `Auth.common` error string is surfaced via
 * `setServerError`.
 */
export async function initiateGoogleSignIn(
  setServerError: Dispatch<SetStateAction<string | null>>,
  tCommon: (key: string) => string
): Promise<void> {
  setServerError(null);
  try {
    const res = await api.get("/api/v1/auth/oauth/google/start");
    if (!res.ok) {
      setServerError(tCommon("genericError"));
      return;
    }
    const data: { authorize_url?: string } = await res.json();
    if (!data.authorize_url) {
      setServerError(tCommon("genericError"));
      return;
    }
    window.location.href = data.authorize_url;
  } catch {
    setServerError(tCommon("networkError"));
  }
}
