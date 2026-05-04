"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AchievementsTab } from "./tabs/achievements-tab";
import { CertificatesTab } from "./tabs/certificates-tab";
import { EducationTab } from "./tabs/education-tab";
import { EmploymentTab } from "./tabs/employment-tab";
import { LanguagesTab } from "./tabs/languages-tab";
import { PersonalInfoTab } from "./tabs/personal-info-tab";
import { ProfileSummaryTab } from "./tabs/profile-summary-tab";
import { ProjectsTab } from "./tabs/projects-tab";
import { SkillsTab } from "./tabs/skills-tab";
import { VolunteerTab } from "./tabs/volunteer-tab";

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
  const tDialog = useTranslations("profile.unsavedDialog");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState<TabValue>(initialTab);
  const [pendingTab, setPendingTab] = useState<TabValue | null>(null);

  // Track which tabs currently have unsaved changes. Reset callbacks let the
  // Discard action force the dirty tab to reset its form before we switch.
  const dirtyTabsRef = useRef<Set<TabValue>>(new Set());
  const [, forceRender] = useState(0);

  const setDirty = useCallback((tab: TabValue, isDirty: boolean) => {
    const set = dirtyTabsRef.current;
    const had = set.has(tab);
    if (isDirty && !had) {
      set.add(tab);
      forceRender((n) => n + 1);
    } else if (!isDirty && had) {
      set.delete(tab);
      forceRender((n) => n + 1);
    }
  }, []);

  // Sync URL changes (e.g. browser back/forward) into local state
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (isValidTab(urlTab) && urlTab !== value) {
      setValue(urlTab);
    }
  }, [searchParams, value]);

  function commitChange(next: TabValue) {
    setValue(next);
    router.replace(`/dashboard/profile?tab=${next}`, { scroll: false });
  }

  function handleChange(next: string) {
    if (!isValidTab(next)) return;
    if (next === value) return;
    if (dirtyTabsRef.current.size > 0) {
      // Stage the switch behind a confirmation dialog
      setPendingTab(next);
      return;
    }
    commitChange(next);
  }

  function cancelSwitch() {
    setPendingTab(null);
  }

  function discardAndSwitch() {
    // Clear dirty state — child tabs will re-hydrate from query data on next
    // mount/render, but we also defensively clear the ref here.
    dirtyTabsRef.current.clear();
    forceRender((n) => n + 1);
    if (pendingTab) {
      const next = pendingTab;
      setPendingTab(null);
      commitChange(next);
    }
  }

  return (
    <>
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

        <TabsContent value="personal-info" className="mt-6">
          <PersonalInfoTab
            onDirtyChange={(d) => setDirty("personal-info", d)}
          />
        </TabsContent>
        <TabsContent value="skills" className="mt-6">
          <SkillsTab onDirtyChange={(d) => setDirty("skills", d)} />
        </TabsContent>
        <TabsContent value="profile-summary" className="mt-6">
          <ProfileSummaryTab
            onDirtyChange={(d) => setDirty("profile-summary", d)}
          />
        </TabsContent>
        <TabsContent value="languages" className="mt-6">
          <LanguagesTab onDirtyChange={(d) => setDirty("languages", d)} />
        </TabsContent>

        <TabsContent value="employment" className="mt-6">
          <EmploymentTab onDirtyChange={(d) => setDirty("employment", d)} />
        </TabsContent>
        <TabsContent value="education" className="mt-6">
          <EducationTab onDirtyChange={(d) => setDirty("education", d)} />
        </TabsContent>
        <TabsContent value="certificates" className="mt-6">
          <CertificatesTab
            onDirtyChange={(d) => setDirty("certificates", d)}
          />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <ProjectsTab onDirtyChange={(d) => setDirty("projects", d)} />
        </TabsContent>
        <TabsContent value="achievements" className="mt-6">
          <AchievementsTab
            onDirtyChange={(d) => setDirty("achievements", d)}
          />
        </TabsContent>
        <TabsContent value="volunteer" className="mt-6">
          <VolunteerTab onDirtyChange={(d) => setDirty("volunteer", d)} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) cancelSwitch();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDialog("title")}</DialogTitle>
            <DialogDescription>{tDialog("description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelSwitch}>
              {tDialog("cancelButton")}
            </Button>
            <Button variant="destructive" onClick={discardAndSwitch}>
              {tDialog("discardButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
