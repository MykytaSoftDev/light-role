'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { CircleAlert, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleIcon } from '@/components/shared/google-icon';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGoogleSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Google OAuth is not configured');
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

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
      const res = await api.post('/api/v1/auth/register', values);
      if (res.ok || res.status === 201) {
        setSuccess(true);
      } else if (res.status === 409) {
        setServerError('Email already registered. Try signing in instead.');
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Unable to connect. Check your internet connection.');
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <MailCheck className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to your inbox. Click it to activate your account.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Already verified?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-4 hover:underline"
            >
              Sign in
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
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 text-white"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -20%, #312e81 0%, transparent 70%), #030712',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white select-none">
            LR
          </div>
          <span className="text-base font-semibold tracking-tight">Light Role</span>
        </div>

        {/* Hero copy */}
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Manage your job search<br />with AI.
          </h1>
          <p className="max-w-xs text-base leading-relaxed text-white/60">
            Optimize your resume for every role, generate tailored cover letters,
            and track every application - all in one place.
          </p>
        </div>

        {/* Testimonial */}
        <div className="space-y-3">
          <blockquote className="text-sm italic leading-relaxed text-white/70">
            &ldquo;Light Role helped me tailor my resume for every application.
            I went from zero callbacks to three offers in six weeks.&rdquo;
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80 select-none">
              MK
            </div>
            <div>
              <p className="text-xs font-medium text-white/90">Marcus K.</p>
              <p className="text-xs text-white/50">Software Engineer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo header */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white select-none">
              LR
            </div>
            <span className="text-sm font-semibold text-foreground">Light Role</span>
          </div>

          {/* Page header */}
          <div className="mb-8 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground">Start managing your job search with AI.</p>
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
                {...register('email')}
                className={cn(errors.email && 'border-destructive focus-visible:ring-destructive')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register('password')}
                className={cn(errors.password && 'border-destructive focus-visible:ring-destructive')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Submit button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* OR divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground tracking-wider">or</span>
            </div>
          </div>

          {/* Google button */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-3 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          {/* Footer link */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
