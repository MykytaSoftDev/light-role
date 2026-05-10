'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

function makeResetPasswordSchema(t: (key: string) => string, tReset: (key: string) => string) {
  return z
    .object({
      password: z.string().min(8, t('passwordMin')),
      confirmPassword: z.string().min(1, t('confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tReset('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });
}

type ResetPasswordFormValues = z.infer<ReturnType<typeof makeResetPasswordSchema>>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;

  const t = useTranslations('Auth.resetPassword');
  const tCommon = useTranslations('Auth.common');
  const tValidation = useTranslations('Auth.validation');

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetPasswordSchema = makeResetPasswordSchema(tValidation, t);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
            <h1 className="text-2xl font-semibold">{t('invalidLinkTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('noTokenBody')}</p>
            <Link
              href="/auth/forgot-password"
              className="text-primary hover:text-primary/80 mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              {t('requestResetLink')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      const res = await api.post('/api/v1/auth/reset-password', {
        token,
        password: values.password,
      });
      if (res.ok || res.status === 200) {
        router.push('/auth/login?reset=success');
      } else if (res.status === 400 || res.status === 422) {
        setServerError(t('tokenInvalid'));
      } else {
        setServerError(tCommon('genericError'));
      }
    } catch {
      setServerError(tCommon('networkError'));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('newPasswordLabel')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('passwordPlaceholder')}
                  {...register('password')}
                  className={cn('pr-10', errors.password && 'border-destructive focus-visible:ring-destructive')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={tCommon('passwordPlaceholder')}
                  {...register('confirmPassword')}
                  className={cn('pr-10', errors.confirmPassword && 'border-destructive focus-visible:ring-destructive')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Server error */}
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
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/auth/login"
              className="text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline"
            >
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
  const tStates = useTranslations('Common.states');
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <p className="text-sm text-muted-foreground">{tStates('loading')}</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
