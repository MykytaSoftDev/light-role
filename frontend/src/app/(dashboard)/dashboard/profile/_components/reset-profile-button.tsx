"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function ResetProfileButton() {
  const t = useTranslations("profile");

  return (
    /* TODO(PROFILE-7): wire up Reset Profile flow */
    <Button variant="outline" size="sm" onClick={() => {}}>
      {t("resetButton")}
    </Button>
  );
}
