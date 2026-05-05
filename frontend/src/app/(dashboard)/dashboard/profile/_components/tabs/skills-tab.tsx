"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/api/useProfile";
import { useUpdateProfile } from "@/hooks/api/useUpdateProfile";
import type { ProfileResponse, SkillEntry } from "@/lib/profile-api";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// See languages-tab.tsx for why `id` must be `nullish()` and not `optional()`.
const skillsSchema = z.object({
  skills: z.array(
    z.object({
      id: z.string().nullish(),
      name: z.string(),
    })
  ),
});

type SkillsFormValues = z.infer<typeof skillsSchema>;

interface SkillsTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

/** See personal-info-tab.tsx for the wrapper-gates-on-data rationale. */
export function SkillsTab({ onDirtyChange }: SkillsTabProps) {
  const tCommon = useTranslations("profile.common");
  const { data, isLoading, isError } = useProfile();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
        ))}
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
    <SkillsForm
      key={`${data.id}:${data.updated_at}`}
      initialData={data}
      onDirtyChange={onDirtyChange}
    />
  );
}

interface SkillsFormProps {
  initialData: ProfileResponse;
  onDirtyChange?: (isDirty: boolean) => void;
}

function deriveDefaults(data: ProfileResponse): SkillsFormValues {
  // Stamp a UUID on any entry that arrives without one (the AI parser does
  // not assign IDs). This way the next PATCH preserves a stable id per row.
  return {
    skills: (data.profile_data?.skills ?? []).map((s) => ({
      id: s.id ?? crypto.randomUUID(),
      name: s.name,
    })),
  };
}

function SkillsForm({ initialData, onDirtyChange }: SkillsFormProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.skills");
  const updateProfile = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaults = deriveDefaults(initialData);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting, isDirty },
  } = useForm<SkillsFormValues>({
    resolver: zodResolver(skillsSchema),
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: SkillsFormValues) {
    setServerError(null);
    setSuccessMessage(null);

    const cleaned: SkillEntry[] = (values.skills ?? [])
      .filter((s) => s.name.trim() !== "")
      .map((s) => ({
        id: s.id ?? crypto.randomUUID(),
        name: s.name.trim(),
      }));

    try {
      await updateProfile.mutateAsync({ skills: cleaned });
      reset({
        skills: cleaned.map((s) => ({
          id: s.id ?? crypto.randomUUID(),
          name: s.name,
        })),
      });
      setSuccessMessage(tCommon("savedToast"));
      toast.success(tCommon("savedToast"));
    } catch {
      setServerError(tCommon("saveErrorToast"));
      toast.error(tCommon("saveErrorToast"));
    }
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
        <div className="space-y-3">
          <Label>{tSection("nameLabel")}</Label>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No skills yet. Add one below.
            </p>
          )}
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="grid grid-cols-[1fr_auto] items-start gap-2">
                <Input
                  type="text"
                  placeholder={tSection("nameLabel")}
                  {...register(`skills.${index}.name` as const)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tSection("removeSkill")}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ id: crypto.randomUUID(), name: "" })}
          >
            <Plus className="h-4 w-4" />
            {tSection("addSkill")}
          </Button>
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
