import "server-only";
import { cookies } from "next/headers";

export interface AuthState {
  isAuthenticated: boolean;
}

export async function getAuthState(): Promise<AuthState> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return { isAuthenticated: false };

  const parts = token.split(".");
  if (parts.length !== 3) return { isAuthenticated: false };

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return { isAuthenticated: false };
    const nowSeconds = Math.floor(Date.now() / 1000);
    return { isAuthenticated: payload.exp > nowSeconds };
  } catch {
    return { isAuthenticated: false };
  }
}
