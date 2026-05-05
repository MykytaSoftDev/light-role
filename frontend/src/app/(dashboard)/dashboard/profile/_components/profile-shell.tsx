"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useProfile } from "@/hooks/api/useProfile";
import { isProfileEmpty } from "@/lib/profile-api";
import { ProfileTabs } from "./profile-tabs";
import { ProfileEmptyState } from "./profile-empty-state";

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

interface ProfileShellProps {
  initialTab: TabValue;
}

/**
 * Decides between the empty-state picker and the regular tabbed editor:
 *   - First-time visitors with no profile data see the side-by-side
 *     "Upload resume / Start manually" picker.
 *   - Once any field is populated (or the user clicks "Start manually"),
 *     the regular tabs render.
 */
export function ProfileShell({ initialTab }: ProfileShellProps) {
  const { data, isLoading, isError } = useProfile();
  const t = useTranslations("profile.common");
  // Local override that lets "Or fill out manually" bypass the empty state
  // without a backend write. The user_profiles row already exists from the
  // auto-create on GET, so we only need to flip a UI flag.
  const [forceTabs, setForceTabs] = useState(false);

  if (isLoading || !data) {
    return <ProfileTabsSkeleton />;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
      >
        {t("loadErrorMessage")}
      </div>
    );
  }

  if (!forceTabs && isProfileEmpty(data.profile_data)) {
    return <ProfileEmptyState onContinueManually={() => setForceTabs(true)} />;
  }

  return <ProfileTabs initialTab={initialTab} />;
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
