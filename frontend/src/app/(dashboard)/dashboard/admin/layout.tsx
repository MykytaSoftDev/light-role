import { cookies } from "next/headers";
import { notFound } from "next/navigation";

// Non-admin users (including unauthenticated) hit notFound() — they see
// the same 404 as for any other unknown URL, hiding the existence of /admin.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) notFound();

  // Server-side fetch: prefer INTERNAL_API_URL (e.g. http://backend:8000 in
  // Docker compose) over the browser-facing NEXT_PUBLIC_API_URL. The latter
  // resolves to localhost from inside the frontend container and fails with
  // ECONNREFUSED.
  const apiUrl =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";
  const res = await fetch(`${apiUrl}/api/v1/admin/me`, {
    headers: { cookie: `access_token=${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) notFound();

  return <>{children}</>;
}
