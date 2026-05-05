"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function ResetProfileButton() {
  const t = useTranslations("profile");

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/dashboard/profile/reupload">{t("resetButton")}</Link>
    </Button>
  );
}
