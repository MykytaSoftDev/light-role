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
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null);
    try {
      const res = await api.post('/api/v1/auth/forgot-password', values);
      if (res.ok || res.status === 200) {
        setSubmitted(true);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Unable to connect. Check your internet connection.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {!submitted ? (
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="mb-6 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

              {serverError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link
                href="/auth/login"
                className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <MailCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If that email is registered, you&apos;ll receive a link shortly. Check your spam folder if you don&apos;t see it.
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
