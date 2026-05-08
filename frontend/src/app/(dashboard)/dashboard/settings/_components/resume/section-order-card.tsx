"use client";

/**
 * PREFS-1 — Section Order card.
 *
 * Spec: docs/v2/specs/resume-preferences-spec.md §4.
 *
 * Owns:
 *   - Local order state (`localOrder`).
 *   - Per-block dirty flag against the server-persisted order.
 *   - PATCH /users/me/resume-preferences with `{ sections_order }` only.
 *   - Cache slice update on 200 + sonner success toast; sonner error on 4xx/5xx.
 */
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LayoutList, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  REORDERABLE_SECTION_KEYS,
  SortableSectionList,
  normalizeOrder,
  type ReorderableSectionKey,
} from "@/components/resume/sortable-section-list";
import { queryKeys } from "@/hooks/api/keys";
import {
  ResumePreferencesError,
  updateResumePreferences,
  type CurrentUser,
  type ResumePreferences,
} from "@/lib/user";

interface SectionOrderCardProps {
  /** Server-persisted order. Undefined while the user is loading. */
  serverOrder: string[] | undefined;
  /** True while the parent's user query is in its first load. */
  isLoading: boolean;
  /** True when the user query failed (initial GET). */
  isLoadError: boolean;
  /** Trigger a refetch from the parent's user query. */
  onRetryLoad: () => void;
}

export function SectionOrderCard({
  serverOrder,
  isLoading,
  isLoadError,
  onRetryLoad,
}: SectionOrderCardProps) {
  const t = useTranslations("settings.resume");
  const queryClient = useQueryClient();

  // Local-local order. Initialized from server (or default) and re-synced
  // on background refetches *only* when the block is clean. See spec §7.4.
  const [localOrder, setLocalOrder] = React.useState<ReorderableSectionKey[]>(
    () => normalizeOrder(serverOrder ?? REORDERABLE_SECTION_KEYS.slice())
  );

  const isDirty = React.useMemo(() => {
    if (!serverOrder) return false;
    const normalized = normalizeOrder(serverOrder);
    if (normalized.length !== localOrder.length) return true;
    for (let i = 0; i < normalized.length; i += 1) {
      if (normalized[i] !== localOrder[i]) return true;
    }
    return false;
  }, [serverOrder, localOrder]);

  // Re-sync when server data arrives or refetches — but never overwrite
  // local edits (spec §7.1, §7.5 cross-tab race).
  React.useEffect(() => {
    if (!serverOrder) return;
    if (isDirty) return;
    const normalized = normalizeOrder(serverOrder);
    setLocalOrder((prev) => {
      if (prev.length === normalized.length) {
        let same = true;
        for (let i = 0; i < normalized.length; i += 1) {
          if (prev[i] !== normalized[i]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return normalized;
    });
    // We deliberately depend on serverOrder identity — when react-query
    // returns a fresh array reference the effect re-runs. `isDirty` is
    // included so we recompute "should I sync?" when the user reverts edits.
  }, [serverOrder, isDirty]);

  const mutation = useMutation({
    mutationFn: (next: ReorderableSectionKey[]) =>
      updateResumePreferences({ sections_order: next }),
    onSuccess: (response) => {
      // Slice-update the user cache so dependent reads (sidebar, editor) stay
      // coherent without a refetch. (spec §8.2)
      queryClient.setQueryData<CurrentUser | undefined>(
        queryKeys.user.me,
        (old) => (old ? { ...old, resume_preferences: response } : old)
      );
      toast.success(t("saveSuccessToast"));
    },
    onError: (error) => {
      if (error instanceof ResumePreferencesError && error.status === 422) {
        toast.error(t("saveError.validation"));
      } else {
        toast.error(t("saveError.network"));
      }
    },
  });

  function handleSave() {
    if (!isDirty || mutation.isPending) return;
    mutation.mutate(localOrder);
  }

  const showSkeleton = isLoading && !serverOrder;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          {t("sectionOrder.title")}
        </CardTitle>
        <CardDescription>{t("sectionOrder.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoadError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{t("loadError")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onRetryLoad}>
              {t("retry")}
            </Button>
          </div>
        ) : showSkeleton ? (
          <div className="space-y-1.5">
            {Array.from({ length: REORDERABLE_SECTION_KEYS.length }).map(
              (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              )
            )}
          </div>
        ) : (
          <SortableSectionList value={localOrder} onChange={setLocalOrder} />
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending || isLoadError || showSkeleton}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("savingButton")}
            </>
          ) : (
            t("saveButton")
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export type { ResumePreferences };
