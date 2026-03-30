import { api } from "./api";

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
}

// ── API call ───────────────────────────────────────────────────────────────

export async function getUserData(): Promise<CurrentUser> {
  const res = await api.get("/api/v1/users/me");
  if (!res.ok) throw new Error("auth");
  return res.json();
}