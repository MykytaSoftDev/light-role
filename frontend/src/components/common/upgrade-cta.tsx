"use client";

import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface UpgradeCtaProps {
  message?: string;
  size?: "sm" | "default";
  className?: string;
}

export function UpgradeCta({
  message,
  size = "sm",
  className,
}: UpgradeCtaProps) {
  const tBadge = useTranslations("Sidebar.planBadge");
  const tCommon = useTranslations("Common.upgradeCta");

  const finalMessage = message ?? tCommon("defaultMessage");

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-sm text-muted-foreground">{finalMessage}</span>
      <Button size={size} asChild>
        <Link href="/dashboard/checkout">
          <Zap className="h-3.5 w-3.5" />
          {tBadge("upgrade")}
        </Link>
      </Button>
    </div>
  );
}
