"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LanguageSelector } from "./language-selector";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  auth_provider: string;
  is_verified: boolean;
}

const accountSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Please enter a valid email address"),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountTab() {
  const t = useTranslations("settings");
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOAuthUser = user?.auth_provider === "google";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
    },
  });

  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const showNameHint = !firstName?.trim() && !lastName?.trim();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await api.get("/api/v1/users/me");
        if (res.ok) {
          const data: User = await res.json();
          setUser(data);
          reset({
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            email: data.email,
          });
        } else {
          setLoadError("Failed to load your account information.");
        }
      } catch {
        setLoadError("Unable to connect. Check your internet connection.");
      }
    }

    fetchUser();
  }, [reset]);

  async function onSubmit(values: AccountFormValues) {
    setServerError(null);
    setSuccessMessage(null);

    const body: Record<string, string> = {
      email: values.email,
      first_name: values.first_name ?? "",
      last_name: values.last_name ?? "",
    };

    try {
      const res = await api.patch("/api/v1/users/me", body);
      if (res.ok) {
        const updated: User = await res.json();
        setUser(updated);
        reset({
          first_name: updated.first_name ?? "",
          last_name: updated.last_name ?? "",
          email: updated.email,
        });
        setSuccessMessage("Your account has been updated successfully.");
      } else if (res.status === 409) {
        setServerError("That email address is already in use.");
      } else if (res.status === 422) {
        setServerError("Please check your input and try again.");
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Unable to connect. Check your internet connection.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tab header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("account.heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("account.description")}</p>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Form skeleton while loading */}
      {!user && !loadError && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ))}
          <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
        </div>
      )}

      {/* Account form */}
      {user && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                autoComplete="given-name"
                placeholder={t("account.placeholders.firstName")}
                {...register("first_name")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                autoComplete="family-name"
                placeholder={t("account.placeholders.lastName")}
                {...register("last_name")}
              />
            </div>
          </div>

          {/* Name hint */}
          {showNameHint ? (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Add your name to personalize your experience.</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Your name will be displayed on your profile and documents.
            </p>
          )}

          {/* Email field */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            {isOAuthUser ? (
              <>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="cursor-not-allowed opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Your email is managed by Google and cannot be changed here.
                </p>
              </>
            ) : (
              <>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("account.placeholders.email")}
                  {...register("email")}
                  className={cn(
                    errors.email && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
              <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      )}

      {/* Language section — saves immediately on change, separate from the
          form above. Displayed regardless of user load state. */}
      <div className="space-y-4">
        <div>
          <h2 className="text-foreground text-xl font-semibold">
            {t("account.language.heading")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("account.language.description")}
          </p>
        </div>
        <LanguageSelector />
      </div>
    </div>
  );
}
