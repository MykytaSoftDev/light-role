import { ChevronLeft } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");
  if (!token) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <a
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </a>
          <div className="flex flex-1 justify-center">
            <span className="text-base font-semibold text-foreground">Light Role</span>
          </div>
          {/* Spacer mirrors the back link width so the logo stays centered */}
          <div className="w-32" />
        </div>
      </header>
      {children}
    </div>
  );
}
