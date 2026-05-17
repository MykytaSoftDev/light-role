import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Logo } from "@/components/landing/brand/logo";
import { Button } from "@/components/ui/button";
import { getAuthState } from "@/lib/auth/get-auth-state";

import { Container } from "./container";
import { LangWidget } from "./lang-widget";

export async function Header() {
  const t = await getTranslations("Marketing.chrome.header");
  const { isAuthenticated } = await getAuthState();

  return (
    <header className="sticky top-0 z-[5] h-[72px] border-b border-[var(--color-border)] bg-[var(--color-background)]">
      <Container className="h-full">
        <div className="flex h-full items-center gap-4">
          <Link href="/" className="inline-flex items-center no-underline">
            <Logo size={30} />
          </Link>
          <div className="flex-1" />
          <LangWidget ariaLabel={t("langSwitcherLabel")} />
          {!isAuthenticated && (
            <Link
              href="/auth/login"
              className="hidden md:inline-flex h-9 items-center px-2.5 font-display text-sm font-medium text-[var(--color-foreground)] no-underline hover:opacity-80"
            >
              {t("login")}
            </Link>
          )}
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">{t("ctaAuthed")}</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/auth/register">
                {t("ctaPrimary")}
                <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </Container>
    </header>
  );
}
