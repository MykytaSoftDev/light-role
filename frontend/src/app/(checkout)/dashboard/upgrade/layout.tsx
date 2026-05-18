import { CheckoutGradients } from "@/components/gradients/checkout-gradients";
import { ChevronLeft } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import "@/styles/checkout.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function UpgradeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");

  if (!token) {
    redirect("/auth/login?redirect=/dashboard/upgrade");
  }

  // Server-side Pro check — redirect Pro users away from the upgrade page
  try {
    const res = await fetch(`${BASE_URL}/api/v1/subscriptions/current`, {
      headers: { Cookie: `access_token=${token.value}` },
      cache: "no-store",
    });
    if (res.ok) {
      const sub = await res.json();
      if (sub?.plan_slug && sub.plan_slug !== "free") {
        redirect("/dashboard/subscription");
      }
    }
  } catch {
    // Network error — allow the page to render, client-side will handle it
  }

  const tBranding = await getTranslations("Auth.branding");
  const tFooter = await getTranslations("upgrade.footer");

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <a
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {tFooter("back")}
          </a>
          <div className="flex flex-1 justify-center">
            <Image
              src="/assets/logo/lightrole-text.svg"
              width={200}
              height={200}
              alt={tBranding("logoAlt")}
            />
          </div>
          {/* Spacer mirrors the back link width so the logo stays centered */}
          <div className="w-32" />
        </div>
      </header>
      <div className="relative min-h-screen w-full overflow-hidden">
        <CheckoutGradients />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-between gap-6 px-[16px] py-[24px] md:px-[32px]">
          {children}
        </div>
      </div>
    </div>
  );
}
