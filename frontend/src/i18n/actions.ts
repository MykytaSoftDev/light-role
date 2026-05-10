"use server";

import { cookies } from "next/headers";

import { isLocale } from "./locales";

const LOCALE_COOKIE = "NEXT_LOCALE";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type SetLocaleResult = { ok: true } | { ok: false; error: "INVALID_LOCALE" };

export async function setLocale(locale: string): Promise<SetLocaleResult> {
  if (!isLocale(locale)) {
    return { ok: false, error: "INVALID_LOCALE" };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });

  return { ok: true };
}
