import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Marketing.landing");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-xl text-muted-foreground">{t("tagline")}</p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <a href="/auth/register">{t("ctaPrimary")}</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/auth/login">{t("ctaSecondary")}</a>
        </Button>
      </div>
    </main>
  );
}
