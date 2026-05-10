import Link from "next/link";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("Errors.notFound");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-10 w-10 text-muted-foreground" />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{t("title")}</h1>

      <p className="mt-3 max-w-sm text-muted-foreground">{t("description")}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">{t("goHome")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("goLanding")}</Link>
        </Button>
      </div>
    </div>
  );
}
