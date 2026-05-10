"use client";

import StreakBackground from "@/components/streak-background";
import { GoogleIcon } from "@/components/shared/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

function makeRegisterSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("invalidEmail")),
    password: z.string().min(8, t("passwordMin")),
  });
}

type RegisterFormValues = z.infer<ReturnType<typeof makeRegisterSchema>>;

export default function RegisterPage() {
  const t = useTranslations("Auth.register");
  const tCommon = useTranslations("Auth.common");
  const tBranding = useTranslations("Auth.branding");
  const tValidation = useTranslations("Auth.validation");
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGoogleSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert(tCommon("googleNotConfigured"));
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const scope = "openid email profile";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  const registerSchema = makeRegisterSchema(tValidation);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      const res = await api.post("/api/v1/auth/register", values);
      if (res.ok || res.status === 201) {
        setSuccess(true);
      } else if (res.status === 409) {
        setServerError(t("alreadyRegistered"));
      } else {
        setServerError(tCommon("genericError"));
      }
    } catch {
      setServerError(tCommon("networkError"));
    }
  }

  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <MailCheck className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold">{t("checkEmail.title")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("checkEmail.description")}
          </p>
          <p className="text-muted-foreground mt-6 text-sm">
            {t("checkEmail.alreadyVerified")}{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline"
            >
              {t("checkEmail.signIn")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — always dark, hidden on mobile/tablet */}
      <div
        className="dark text-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:w-[45%]"
        style={{ background: "oklch(10% 0.01 286)" }}
      >
        <StreakBackground />
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold select-none">
            LR
          </div>
          <span className="text-base font-semibold tracking-tight">
            {tBranding("logoFallback")}
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-4">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            {tBranding("headline")}
          </h1>
          <p className="text-muted-foreground max-w-xs text-base leading-relaxed">
            {tBranding("tagline")}
          </p>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 space-y-3">
          <blockquote className="text-muted-foreground text-sm leading-relaxed italic">
            &ldquo;{tBranding("testimonialQuote")}&rdquo;
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium select-none">
              MK
            </div>
            <div>
              <p className="text-foreground text-xs font-medium">
                {tBranding("testimonialName")}
              </p>
              <p className="text-muted-foreground text-xs">
                {tBranding("testimonialTitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="bg-background flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo header */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold select-none">
              LR
            </div>
            <span className="text-foreground text-sm font-semibold">
              {tBranding("logoFallback")}
            </span>
          </div>

          {/* Page header */}
          <div className="mb-8 space-y-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <Label htmlFor="email">{tCommon("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={tCommon("emailPlaceholder")}
                {...register("email")}
                className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <Label htmlFor="password">{tCommon("passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("passwordPlaceholder")}
                {...register("password")}
                className={cn(
                  errors.password && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors.password && (
                <p className="text-destructive text-xs">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Submit button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </form>

          {/* OR divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2 tracking-wider">
                {tCommon("or")}
              </span>
            </div>
          </div>

          {/* Google button */}
          <Button
            type="button"
            variant="outline"
            className="hover:border-primary hover:bg-primary/10 hover:text-primary w-full gap-3"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            {tCommon("continueWithGoogle")}
          </Button>

          {/* Footer link */}
          <p className="text-muted-foreground mt-8 text-center text-sm">
            {t("haveAccount")}{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
