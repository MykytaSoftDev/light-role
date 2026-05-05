import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ProfileShell } from "./_components/profile-shell";
import { ResetProfileButton } from "./_components/reset-profile-button";

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

function isValidTab(v: string | undefined): v is TabValue {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: TabValue = isValidTab(tab) ? tab : "personal-info";
  const t = await getTranslations("profile");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ResetProfileButton />
      </div>

      <Suspense fallback={<ProfileTabsSkeleton />}>
        <ProfileShell initialTab={initialTab} />
      </Suspense>
    </div>
  );
}

function ProfileTabsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 shrink-0 animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
