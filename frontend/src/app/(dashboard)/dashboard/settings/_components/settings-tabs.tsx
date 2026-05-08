"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountTab } from "./account-tab";
import { NotificationsTab } from "./notifications-tab";
import { ResumeTab } from "./resume-tab";
import { SecurityTab } from "./security-tab";

type TabValue = "account" | "security" | "notifications" | "resume";
const VALID_TABS: readonly TabValue[] = [
  "account",
  "security",
  "notifications",
  "resume",
] as const;

function isValidTab(v: string | null): v is TabValue {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

interface SettingsTabsProps {
  initialTab: TabValue;
}

export function SettingsTabs({ initialTab }: SettingsTabsProps) {
  const t = useTranslations("settings");
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
    router.replace(`/dashboard/settings?tab=${next}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={handleChange}>
      <TabsList
        aria-label={t("tabs.ariaLabel")}
        className="scrollbar-none justify-start overflow-x-auto"
      >
        <TabsTrigger value="account">{t("tabs.account")}</TabsTrigger>
        <TabsTrigger value="security">{t("tabs.security")}</TabsTrigger>
        <TabsTrigger value="notifications">{t("tabs.notifications")}</TabsTrigger>
        <TabsTrigger value="resume">{t("tabs.resume")}</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="mt-6">
        <AccountTab />
      </TabsContent>
      <TabsContent value="security" className="mt-6">
        <SecurityTab />
      </TabsContent>
      <TabsContent value="notifications" className="mt-6">
        <NotificationsTab />
      </TabsContent>
      <TabsContent value="resume" className="mt-6">
        <ResumeTab />
      </TabsContent>
    </Tabs>
  );
}
