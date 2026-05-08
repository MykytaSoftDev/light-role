import { Suspense } from "react";
import { SettingsTabs } from "./_components/settings-tabs";

type TabValue = "account" | "security" | "notifications" | "resume";
const VALID_TABS: readonly TabValue[] = [
  "account",
  "security",
  "notifications",
  "resume",
] as const;

function isValidTab(v: string | undefined): v is TabValue {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: TabValue = isValidTab(tab) ? tab : "account";

  return (
    <Suspense fallback={<SettingsTabsSkeleton />}>
      <SettingsTabs initialTab={initialTab} />
    </Suspense>
  );
}

function SettingsTabsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
