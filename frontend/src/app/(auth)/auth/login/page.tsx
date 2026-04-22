"use client";

import { AUTH_PANEL_GRADIENT } from "@/app/(auth)/_lib/auth-panel";
import { GoogleIcon } from "@/components/shared/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleGoogleSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    console.log(clientId);
    if (!clientId) {
      alert("Google OAuth is not configured");
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const scope = "openid email profile";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const res = await api.post("/api/v1/auth/login", values);
      if (res.ok) {
        router.push("/dashboard");
      } else if (res.status === 401 || res.status === 400) {
        setServerError("Invalid email or password.");
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Unable to connect. Check your internet connection.");
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — always dark, hidden on mobile/tablet */}
      <div
        className="dark text-foreground hidden flex-col justify-between p-12 lg:flex lg:w-[45%]"
        style={{ background: AUTH_PANEL_GRADIENT }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          {/* <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold select-none">
            LR
          </div> */}
          <Image
            src="/assets/logo/lightrole-text.svg"
            width={250}
            height={300}
            alt="LightRole Logo"
          />
          {/* <span className="text-base font-semibold tracking-tight">Light Role</span> */}
        </div>

        {/* Hero copy */}
        <div className="space-y-4">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            Manage your job search
            <br />
            with AI.
          </h1>
          <p className="text-muted-foreground max-w-xs text-base leading-relaxed">
            Optimize your resume for every role, generate tailored cover letters, and track every
            application - all in one place.
          </p>
        </div>

        {/* Testimonial */}
        <div className="space-y-3">
          <blockquote className="text-muted-foreground text-sm leading-relaxed italic">
            &ldquo;Light Role helped me tailor my resume for every application. I went from zero
            callbacks to three offers in six weeks.&rdquo;
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium select-none">
              MK
            </div>
            <div>
              <p className="text-foreground text-xs font-medium">Marcus K.</p>
              <p className="text-muted-foreground text-xs">Software Engineer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        data-slot="card"
        className="bg-background flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-16"
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo header */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            {/* <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold select-none">
              LR
            </div> */}
            <Image
              src="/assets/logo/lightrole-text.svg"
              width={250}
              height={300}
              alt="LightRole Logo"
            />
          </div>

          {/* Page header */}
          <div className="mb-8 space-y-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Sign in to Light Role
            </h1>
            <p className="text-muted-foreground text-sm">Welcome back. Enter your details below.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
                className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-primary hover:text-primary/80 text-xs underline-offset-4 transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
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
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* OR divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2 tracking-wider">or</span>
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
            Continue with Google
          </Button>

          {/* Footer link */}
          <p className="text-muted-foreground mt-8 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
