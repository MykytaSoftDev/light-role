"use client";

/**
 * PREFS-1 — Font card.
 *
 * Spec: docs/v2/specs/resume-preferences-spec.md §5.
 *
 * Each `<SelectItem>` (and the closed trigger) renders its label using its
 * own font-family, so the user sees "Roboto" in Roboto, "Lato" in Lato, etc.
 * Tailwind v4 arbitrary values can't resolve dynamic fonts at runtime, so we
 * use inline `style={{ fontFamily }}` via `getResumeFontFamily`.
 */
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Loader2, Type } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/hooks/api/keys";
import {
  RESUME_FONTS,
  getResumeFontFamily,
  type ResumeFont,
} from "@/lib/fonts/resume-fonts";
import {
  ResumePreferencesError,
  updateResumePreferences,
  type CurrentUser,
} from "@/lib/user";

interface FontCardProps {
  /** Server-persisted font. Undefined while the user is loading. */
  serverFont: ResumeFont | undefined;
  /** True while the parent's user query is in its first load. */
  isLoading: boolean;
  /** True when the user query failed (initial GET). */
  isLoadError: boolean;
  /** Trigger a refetch from the parent's user query. */
  onRetryLoad: () => void;
}

const DEFAULT_FONT: ResumeFont = "Inter";

function isResumeFont(value: string): value is ResumeFont {
  return (RESUME_FONTS as readonly string[]).includes(value);
}

export function FontCard({
  serverFont,
  isLoading,
  isLoadError,
  onRetryLoad,
}: FontCardProps) {
  const t = useTranslations("settings.resume");
  const queryClient = useQueryClient();

  const [localFont, setLocalFont] = React.useState<ResumeFont>(
    serverFont ?? DEFAULT_FONT
  );

  const effectiveServerFont = serverFont ?? DEFAULT_FONT;
  const isDirty = serverFont != null && localFont !== serverFont;

  // Re-sync local state from server, but only while clean. (spec §7.1, §7.5)
  React.useEffect(() => {
    if (!serverFont) return;
    if (isDirty) return;
    setLocalFont(serverFont);
  }, [serverFont, isDirty]);

  const mutation = useMutation({
    mutationFn: (next: ResumeFont) =>
      updateResumePreferences({ font: next }),
    onSuccess: (response) => {
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
    mutation.mutate(localFont);
  }

  function handleValueChange(value: string) {
    if (isResumeFont(value)) {
      setLocalFont(value);
    }
  }

  const showSkeleton = isLoading && !serverFont;
  // The trigger previews the *active* font even before save.
  const triggerFontFamily = getResumeFontFamily(
    showSkeleton ? DEFAULT_FONT : localFont || effectiveServerFont
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Type className="h-4 w-4 text-muted-foreground" />
          {t("font.title")}
        </CardTitle>
        <CardDescription>{t("font.description")}</CardDescription>
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
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="resume-font">{t("font.label")}</Label>
            {showSkeleton ? (
              <Skeleton className="h-9 w-full sm:w-72" />
            ) : (
              <Select value={localFont} onValueChange={handleValueChange}>
                <SelectTrigger
                  id="resume-font"
                  className="w-full sm:w-72"
                  style={{ fontFamily: triggerFontFamily }}
                >
                  <SelectValue placeholder={t("font.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {RESUME_FONTS.map((font) => (
                    <SelectItem
                      key={font}
                      value={font}
                      style={{ fontFamily: getResumeFontFamily(font) }}
                    >
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">{t("font.hint")}</p>
          </div>
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
