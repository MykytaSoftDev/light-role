import { CheckoutGradients } from "@/components/gradients/checkout-gradients";
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
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <a
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </a>
          <div className="flex flex-1 justify-center">
            {/* <span className="text-base font-semibold text-foreground">Light Role</span> */}
          </div>
          {/* Spacer mirrors the back link width so the logo stays centered */}
          <div className="w-32" />
        </div>
      </header>
      <div className={"relative min-h-screen w-full overflow-hidden"}>
        <CheckoutGradients />
        <div
          className={
            "relative mx-auto flex max-w-6xl flex-col justify-between gap-6 px-[16px] py-[24px] md:px-[32px]"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
