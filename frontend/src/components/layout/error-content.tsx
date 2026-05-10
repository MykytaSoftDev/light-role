"use client";

import { useTranslations } from "next-intl";

export function ErrorContent() {
  const t = useTranslations("Common.toast");
  return <div className={"text-center"}>{t("genericError")}</div>;
}
