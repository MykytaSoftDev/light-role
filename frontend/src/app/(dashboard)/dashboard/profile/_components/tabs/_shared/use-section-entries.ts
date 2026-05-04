"use client";

import { useProfile } from "@/hooks/api/useProfile";
import { useUpdateProfile } from "@/hooks/api/useUpdateProfile";
import type {
  AchievementEntry,
  CertificateEntry,
  EducationEntry,
  EmploymentEntry,
  LanguageEntry,
  ProfilePatchRequest,
  ProjectEntry,
  SkillEntry,
  VolunteerEntry,
} from "@/lib/profile-api";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SectionEntryMap = {
  employment: EmploymentEntry;
  education: EducationEntry;
  skills: SkillEntry;
  projects: ProjectEntry;
  languages: LanguageEntry;
  certificates: CertificateEntry;
  achievements: AchievementEntry;
  volunteer: VolunteerEntry;
};

type SectionKey = keyof SectionEntryMap;

interface UseSectionEntriesOptions<K extends SectionKey> {
  /** The ProfileData key this tab manages (e.g. "employment"). */
  sectionKey: K;
  /** Toast text on successful PATCH. */
  successMessage: string;
  /** Toast text on failed PATCH. */
  errorMessage: string;
  /** Toast text shown after an optimistic delete (with an Undo action). */
  deletedMessage: string;
  /** Label for the Undo action button on the deletion toast. */
  undoLabel: string;
  /** Toast text shown when the optimistic delete PATCH fails. */
  deleteErrorMessage: string;
}

interface UseSectionEntriesResult<T> {
  isLoading: boolean;
  isError: boolean;
  /** Locally-held entries — optimistic. Mirrors server on hydrate / revert. */
  entries: T[];
  /** Replace the whole section and PATCH. Reverts on failure. */
  saveEntries: (next: T[]) => Promise<boolean>;
  /**
   * Optimistically delete the entry at `index`, fire PATCH, and surface a
   * sonner toast with an Undo action. Undo restores the entry at its original
   * index and re-PATCHes. No confirmation prompt — the toast IS the safety net.
   */
  deleteEntryWithUndo: (index: number) => void;
}

/**
 * Shared hook for the 6 card-list profile tabs.
 *
 * Loads the profile, exposes a local copy of the section, and gives back
 * a single `saveEntries(next)` callback that does an optimistic-with-revert
 * PATCH against /api/v1/profile.
 *
 * The hook intentionally treats every mutation as a full-section replacement
 * — the backend accepts the entire reordered array and the simplicity beats
 * tracking diffs.
 */
export function useSectionEntries<K extends SectionKey>({
  sectionKey,
  successMessage,
  errorMessage,
  deletedMessage,
  undoLabel,
  deleteErrorMessage,
}: UseSectionEntriesOptions<K>): UseSectionEntriesResult<SectionEntryMap[K]> {
  type T = SectionEntryMap[K];
  const { data, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const [entries, setEntries] = useState<T[]>([]);

  // Hold the latest `entries` in a ref so async undo handlers (which are
  // captured at toast-creation time) always operate on fresh state instead of
  // a stale snapshot.
  const entriesRef = useRef<T[]>(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Hydrate / re-hydrate local state from server data. We can't drive this
  // straight from `data` because we also hold optimistic state during a
  // pending PATCH and need to revert it on failure.
  useEffect(() => {
    if (!data) return;
    const fromServer = (data.profile_data?.[sectionKey] ?? []) as unknown as T[];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(fromServer);
  }, [data, sectionKey]);

  /**
   * Internal: perform an optimistic full-section replacement PATCH.
   *
   * `silent` skips the success toast (used for the delete + undo flow where
   * the toast UX is bespoke and we don't want a generic "Changes saved" to
   * step on the Undo affordance).
   *
   * `onError` lets the delete flow show its own error toast and still
   * reverts state — but only when the caller hasn't already mutated state
   * since the optimistic update (e.g. user issued another action).
   */
  async function patchEntries(
    next: T[],
    options: {
      previous: T[];
      silent?: boolean;
      onErrorMessage?: string;
    }
  ): Promise<boolean> {
    setEntries(next); // optimistic
    try {
      const patch: ProfilePatchRequest = {
        [sectionKey]: next,
      } as unknown as ProfilePatchRequest;
      await updateProfile.mutateAsync(patch);
      if (!options.silent) toast.success(successMessage);
      return true;
    } catch {
      setEntries(options.previous); // revert
      toast.error(options.onErrorMessage ?? errorMessage);
      return false;
    }
  }

  async function saveEntries(next: T[]): Promise<boolean> {
    return patchEntries(next, { previous: entriesRef.current });
  }

  function deleteEntryWithUndo(index: number): void {
    const current = entriesRef.current;
    if (index < 0 || index >= current.length) return;

    const removed = current[index];
    const originalIndex = index;
    const nextAfterDelete = current.filter((_, i) => i !== index);

    // Fire the optimistic delete PATCH. We don't await it — the toast appears
    // immediately and the user can undo while it's in flight.
    void patchEntries(nextAfterDelete, {
      previous: current,
      silent: true,
      onErrorMessage: deleteErrorMessage,
    });

    const toastId = toast(deletedMessage, {
      duration: 5000,
      action: {
        label: undoLabel,
        onClick: () => {
          // Restore the entry at its original index against whatever the
          // current entries are (other deletes/edits may have happened
          // since). Clamp the insertion index so we never go out of bounds.
          const latest = entriesRef.current;
          const insertAt = Math.min(originalIndex, latest.length);
          const restored = [
            ...latest.slice(0, insertAt),
            removed,
            ...latest.slice(insertAt),
          ];
          // Re-PATCH silently — the user just saw a successful undo, no need
          // for a "Changes saved" toast on top.
          void patchEntries(restored, {
            previous: latest,
            silent: true,
            onErrorMessage: errorMessage,
          });
          toast.dismiss(toastId);
        },
      },
    });
  }

  return {
    isLoading,
    isError,
    entries,
    saveEntries,
    deleteEntryWithUndo,
  };
}
