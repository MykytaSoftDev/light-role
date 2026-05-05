"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/api/useProfile";
import { useUpdateProfile } from "@/hooks/api/useUpdateProfile";
import type {
  PersonalInfo,
  ProfileResponse,
  SocialLink,
} from "@/lib/profile-api";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SOCIAL_PLATFORMS = [
  "LinkedIn",
  "GitHub",
  "X",
  "Portfolio",
  "Website",
  "Blog",
  "Facebook",
  "Instagram",
  "YouTube",
  "Dribbble",
  "Behance",
  "Custom",
] as const;

// `id` is `nullish()` (not `optional()`) — the backend serializes Pydantic
// `Optional[UUID] = None` as JSON `null`, and Zod's `optional()` rejects
// `null`, which would silently break Save. See languages-tab.tsx for the
// full write-up.
const personalInfoSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required"),
  phone: z.string().min(1, "Phone is required"),
  location: z.string().optional(),
  social_links: z.array(
    z.object({
      id: z.string().nullish(),
      platform: z.string(),
      url: z.string(),
    })
  ),
});

type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;

interface PersonalInfoTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Wrapper: gates rendering on the profile fetch. The actual form is mounted
 * only after `data` is available so React Hook Form's `defaultValues` are
 * derived from real data at mount time. This avoids a hard-reload race where
 * uncontrolled inputs registered with empty defaults (because `data` was
 * still loading) never picked up the populated `values` prop afterwards.
 */
export function PersonalInfoTab({ onDirtyChange }: PersonalInfoTabProps) {
  const tCommon = useTranslations("profile.common");
  const { data, isLoading, isError } = useProfile();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
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

  // Mount the form with a key tied to the profile id so a Reset Profile (which
  // doesn't change the id but does update `updated_at`) forces a clean remount
  // — guaranteeing `defaultValues` re-derive from the latest server payload.
  return (
    <PersonalInfoForm
      key={`${data.id}:${data.updated_at}`}
      initialData={data}
      onDirtyChange={onDirtyChange}
    />
  );
}

interface PersonalInfoFormProps {
  initialData: ProfileResponse;
  onDirtyChange?: (isDirty: boolean) => void;
}

function deriveDefaults(data: ProfileResponse): PersonalInfoFormValues {
  const pi = data.profile_data?.personal_info;
  return {
    full_name: pi?.full_name ?? "",
    email: pi?.email ?? "",
    phone: pi?.phone ?? "",
    location: pi?.location ?? "",
    // Stamp UUIDs on any links that arrive without one (the AI parser does
    // not assign IDs). Stable ids let RHF useFieldArray track rows correctly
    // and round-trip back to the server on the next save.
    social_links: (pi?.social_links ?? []).map((s) => ({
      id: s.id ?? crypto.randomUUID(),
      platform: s.platform,
      url: s.url,
    })),
  };
}

function PersonalInfoForm({ initialData, onDirtyChange }: PersonalInfoFormProps) {
  const tCommon = useTranslations("profile.common");
  const tSection = useTranslations("profile.personalInfo");
  const updateProfile = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaults = deriveDefaults(initialData);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "social_links",
  });

  // Notify parent of dirty state changes for the unsaved-changes guard
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function onSubmit(values: PersonalInfoFormValues) {
    setServerError(null);
    setSuccessMessage(null);

    // Strip social_link rows where url is blank
    const cleanedSocialLinks: SocialLink[] = (values.social_links ?? [])
      .filter((s) => s.url.trim() !== "")
      .map((s) => ({
        id: s.id ?? crypto.randomUUID(),
        platform: s.platform,
        url: s.url.trim(),
      }));

    const personal_info: PersonalInfo = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      location: values.location?.trim() ? values.location.trim() : null,
      social_links: cleanedSocialLinks,
    };

    try {
      await updateProfile.mutateAsync({ personal_info });
      reset({
        full_name: personal_info.full_name,
        email: personal_info.email,
        phone: personal_info.phone,
        location: personal_info.location ?? "",
        social_links: cleanedSocialLinks.map((s) => ({
          id: s.id ?? crypto.randomUUID(),
          platform: s.platform,
          url: s.url,
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
        <div className="space-y-1.5">
          <Label htmlFor="full_name">
            {tSection("fullNameLabel")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            {...register("full_name")}
            className={cn(
              errors.full_name && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pi_email">
              {tSection("emailLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pi_email"
              type="text"
              autoComplete="email"
              {...register("email")}
              className={cn(
                errors.email && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              {tSection("phoneLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              {...register("phone")}
              className={cn(
                errors.phone && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">{tSection("locationLabel")}</Label>
          <Input
            id="location"
            type="text"
            autoComplete="address-level2"
            {...register("location")}
          />
        </div>

        {/* Social links */}
        <div className="space-y-3">
          <Label>{tSection("socialLinksLabel")}</Label>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No social links yet. Add one below.
            </p>
          )}
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li
                key={field.id}
                className="grid grid-cols-[8rem_1fr_auto] items-start gap-2"
              >
                <Controller
                  control={control}
                  name={`social_links.${index}.platform`}
                  render={({ field: ctrl }) => (
                    <Select value={ctrl.value} onValueChange={ctrl.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={tSection("platformLabel")} />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  type="text"
                  placeholder={tSection("urlLabel")}
                  {...register(`social_links.${index}.url` as const)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tSection("removeSocialLink")}
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
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                platform: "LinkedIn",
                url: "",
              })
            }
          >
            <Plus className="h-4 w-4" />
            {tSection("addSocialLink")}
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
