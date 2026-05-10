import { match } from "@formatjs/intl-localematcher";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale, type Locale } from "./locales";

const LOCALE_COOKIE = "NEXT_LOCALE";

function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter((value): value is string => Boolean(value));
}

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const requested = parseAcceptLanguage(headerStore.get("accept-language"));
  if (requested.length > 0) {
    try {
      const matched = match(requested, SUPPORTED_LOCALES as unknown as string[], DEFAULT_LOCALE);
      if (isLocale(matched)) return matched;
    } catch {
      // fall through to default
    }
  }

  return DEFAULT_LOCALE;
}

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    if (locale !== DEFAULT_LOCALE) {
      console.warn(
        `[i18n] Failed to load messages for "${locale}", falling back to "${DEFAULT_LOCALE}".`,
        error
      );
      return (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
    }
    throw error;
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);
  return { locale, messages };
});
