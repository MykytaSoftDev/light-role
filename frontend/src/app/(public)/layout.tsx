import { getTranslations } from "next-intl/server";

import { Footer } from "@/components/landing/chrome/footer";
import { Header } from "@/components/landing/chrome/header";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Marketing.chrome");
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--color-background)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--color-foreground)] focus:shadow-[0_0_0_2px_var(--color-primary)] focus:outline-none"
      >
        {t("skipToContent")}
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
