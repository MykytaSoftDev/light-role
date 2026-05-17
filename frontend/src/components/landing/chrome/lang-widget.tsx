"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/i18n/actions";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

export function LangWidget({ ariaLabel }: { ariaLabel?: string }) {
  const activeLocale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (code: Locale) => {
    if (code === activeLocale) return;
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        disabled={isPending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-transparent px-2.5 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-60"
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{activeLocale.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 hidden sm:inline-block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => handleSelect(code)}
            className="font-display text-sm"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted-fg)] w-7">
              {code.toUpperCase()}
            </span>
            <span>{LOCALE_LABELS[code]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
