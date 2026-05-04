"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/api/useProfile";
import { useUpdateProfile } from "@/hooks/api/useUpdateProfile";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const profileSummarySchema = z.object({
  summary: z.string(),
});

type ProfileSummaryFormValues = z.infer<typeof profileSummarySchema>;

interface ProfileSummaryTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ProfileSummaryTab({ onDirtyChange }: ProfileSummaryTabProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.profileSummary");
  const { data, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, isDirty },
  } = useForm<ProfileSummaryFormValues>({
    resolver: zodResolver(profileSummarySchema),
    defaultValues: { summary: "" },
  });

  const summaryValue = watch("summary") ?? "";

  useEffect(() => {
    if (!data) return;
    reset({ summary: data.profile_data.summary ?? "" });
  }, [data, reset]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: ProfileSummaryFormValues) {
    setServerError(null);
    setSuccessMessage(null);

    const next = values.summary ?? "";

    try {
      await updateProfile.mutateAsync({ summary: next });
      reset({ summary: next });
      setSuccessMessage(tCommon("savedToast"));
      toast.success(tCommon("savedToast"));
    } catch {
      setServerError(tCommon("saveErrorToast"));
      toast.error(tCommon("saveErrorToast"));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{tCommon("loadErrorMessage")}</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {tSection("heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tSection("description")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="summary">{tSection("label")}</Label>
          <Textarea
            id="summary"
            rows={8}
            placeholder={tSection("placeholder")}
            {...register("summary")}
          />
          <p className="text-xs text-muted-foreground">
            {tSection("charactersCount", { count: summaryValue.length })}
          </p>
        </div>

        {serverError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
            <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tCommon("savingButton")}
            </>
          ) : (
            tCommon("saveButton")
          )}
        </Button>
      </form>
    </div>
  );
}
