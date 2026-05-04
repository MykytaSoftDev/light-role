"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type TabValue =
  | "personal-info"
  | "skills"
  | "profile-summary"
  | "employment"
  | "education"
  | "languages"
  | "certificates"
  | "projects"
  | "achievements"
  | "volunteer";

const VALID_TABS: readonly TabValue[] = [
  "personal-info",
  "skills",
  "profile-summary",
  "employment",
  "education",
  "languages",
  "certificates",
  "projects",
  "achievements",
  "volunteer",
] as const;

function isValidTab(v: string | null): v is TabValue {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

interface ProfileTabsProps {
  initialTab: TabValue;
}

export function ProfileTabs({ initialTab }: ProfileTabsProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState<TabValue>(initialTab);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (isValidTab(urlTab) && urlTab !== value) {
      setValue(urlTab);
    }
  }, [searchParams, value]);

  function handleChange(next: string) {
    if (!isValidTab(next)) return;
    setValue(next);
    router.replace(`/dashboard/profile?tab=${next}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={handleChange}>
      <TabsList
        aria-label={t("tabs.ariaLabel")}
        className="scrollbar-none justify-start overflow-x-auto"
      >
        {VALID_TABS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(`tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {VALID_TABS.map((key) => (
        <TabsContent key={key} value={key} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t(`tabs.${key}`)}</CardTitle>
              <CardDescription>{t("comingSoon")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 rounded-md border border-dashed" />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
