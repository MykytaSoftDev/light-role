# i18n Migration Audit

Generated as part of the next-intl migration of `frontend/src`. This document tracks
every file that contains user-facing hardcoded English text and groups them by
feature area. Files that already use `useTranslations` / `getTranslations` are
listed under "Already migrated" — they may still need follow-up if scoped strings
were missed.

## Conventions used

- **Namespace structure**: `Common` for cross-cutting actions/states; PascalCase
  per feature (`Auth`, `Marketing`, `DashboardShell`, `DashboardHome`, `Resumes`,
  `Jobs`, `CoverLetters`, `Profile`, `Settings`, `Analytics`, `Checkout`,
  `Upgrade`, `Pricing`, `Payments`, `Subscriptions`, `Errors`, `Sidebar`,
  `Notifications`).
- **Sub-namespaces**: PascalCase for top-level sections, camelCase for
  sub-groupings (`actions`, `errors`, `empty`, `toast`).
- **Leaf keys**: camelCase.
- Existing namespaces in `messages/en.json` (`upgrade`, `sidebar`, `feedback`,
  `settings`, `profile`, `analytics`, `support`, `coverLetters`) are preserved
  with lower-case top-level keys for back-compat. New namespaces follow
  PascalCase as the convention going forward.

## Out of scope (excluded from migration)

- `components/ui/*` — shadcn/ui primitives (only "Close" / "Search" labels;
  excluded per task scope).
- Pure logic / hooks without UI strings: `hooks/use-mobile.tsx`,
  `hooks/use-pagination.tsx`, `providers/query.provider.tsx`,
  `components/streak-background.tsx`, `lib/resume/keyword-scroll-context.tsx`.
- Test / spec / storybook files (none present in `frontend/src`).
- `lib/api`, constants, type files — no UI strings.

---

## File checklist

Legend: `[x]` done, `[ ]` pending, `[~]` partially migrated.

### Common shared components → `Common`, `Errors`, `Notifications`

- [x] `src/components/shared/confirmation.tsx`
- [x] `src/components/shared/empty-state.tsx`
- [x] `src/components/shared/status.tsx`
- [x] `src/components/shared/skeleton-list.tsx`
- [x] `src/components/shared/offline-detector.tsx`
- [x] `src/components/shared/rate-limit-modal.tsx`
- [x] `src/components/shared/upgrade-modal.tsx`
- [x] `src/components/common/upgrade-cta.tsx`
- [x] `src/components/layout/error-content.tsx`
- [x] `src/components/layout/loading-screen.tsx`
- [x] `src/components/layout/notification-bell.tsx`
- [x] `src/components/layout/dynamic-breadcrumb.tsx`
- [x] `src/components/layout/theme-switcher.tsx`
- [x] `src/components/layout/header.tsx`
- [x] `src/components/jobs/job-context-menu.tsx`

### Error / 404 pages → `Errors`

- [x] `src/app/error.tsx`
- [x] `src/app/not-found.tsx`
- [x] `src/app/global-error.tsx`
- [x] `src/app/(dashboard)/error.tsx`

### Auth → `Auth`

- [x] `src/app/(auth)/auth/login/page.tsx`
- [x] `src/app/(auth)/auth/register/page.tsx`
- [x] `src/app/(auth)/auth/forgot-password/page.tsx`
- [x] `src/app/(auth)/auth/reset-password/page.tsx`
- [x] `src/app/(auth)/auth/verify-email/page.tsx`
- [x] `src/app/(auth)/auth/callback/google/page.tsx`
- [x] `src/app/(auth)/layout.tsx`

### Public / Marketing → `Marketing`, `Pricing`

- [x] `src/app/(public)/layout.tsx`
- [x] `src/app/(public)/page.tsx`
- [x] `src/app/(public)/pricing/page.tsx`
- [x] `src/app/(public)/pricing/_components/pricing-page-content.tsx`

### Dashboard shell (sidebar / header / layout) → `Sidebar`, `DashboardShell`

- [x] `src/app/(dashboard)/layout.tsx`
- [x] `src/components/layout/sidebar/app-sidebar.tsx`
- [x] `src/components/layout/sidebar/sidebar-main.tsx`
- [x] `src/components/layout/sidebar/sidebar-user.tsx`
- [x] `src/components/layout/sidebar/sidebar-plan-badge.tsx`
- [x] `src/components/layout/sidebar/sidebar-documents.tsx`
- [x] `src/components/layout/sidebar/logout-button.tsx` (already partially)
- [x] `src/components/layout/sidebar/sidebar-secondary.tsx`

### Dashboard home → `DashboardHome`

- [x] `src/app/(dashboard)/dashboard/page.tsx`
- [x] `src/app/(dashboard)/dashboard/_components/complete-steps-panel.tsx`
- [x] `src/app/(dashboard)/dashboard/_components/stat-card-grid.tsx`

### Resumes → `Resumes`

- [x] `src/app/(dashboard)/dashboard/resumes/page.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/page.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/applied-changes-accordion.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/discard-changes-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/download-button.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/edit-button.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/edit-mode-toolbar.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/editor-shell.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/editor-shell-skeleton.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/font-select.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/inline-filename-editor.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/insights-panel.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/matched-keywords.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/preview-frame.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/rating-card.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/rating-stars.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/[id]/_components/reorder-sections-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/_components/delete-resume-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/_components/resume-card.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/_components/resume-card-skeleton.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/_components/resumes-empty-state.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/_components/resumes-filter-bar.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/dev/preview-classic/page.tsx` (dev-only — likely skipped)
- [x] `src/app/(dashboard)/dashboard/resumes/tailor/_components/missing-profile-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/tailor/_components/tailor-wizard-form.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/tailor/loading/page.tsx`
- [x] `src/app/(dashboard)/dashboard/resumes/tailor/page.tsx`
- [x] `src/components/resume/classic-template.tsx`
- [x] `src/components/resume/resume-preview.tsx`
- [x] `src/components/resume/sortable-section-list.tsx`
- [x] `src/components/resume/editor/editable-entry.tsx`
- [x] `src/components/resume/editor/editable-preview.tsx`
- [x] `src/components/resume/editor/editable-section.tsx`
- [x] `src/components/resume/editor/editable-template.tsx`
- [x] `src/components/resume/editor/fields/chip-input-field.tsx`
- [x] `src/components/resume/editor/fields/inline-text-field.tsx`
- [x] `src/components/resume/editor/fields/month-input.tsx`
- [x] `src/components/resume/editor/fields/tiptap-field.tsx`
- [x] `src/components/resume/editor/sections/achievements-editor.tsx`
- [x] `src/components/resume/editor/sections/certificates-editor.tsx`
- [x] `src/components/resume/editor/sections/education-editor.tsx`
- [x] `src/components/resume/editor/sections/employment-editor.tsx`
- [x] `src/components/resume/editor/sections/languages-editor.tsx`
- [x] `src/components/resume/editor/sections/personal-info-editor.tsx`
- [x] `src/components/resume/editor/sections/projects-editor.tsx`
- [x] `src/components/resume/editor/sections/skills-editor.tsx`
- [x] `src/components/resume/editor/sections/summary-editor.tsx`
- [x] `src/components/resume/editor/sections/volunteer-editor.tsx`

### Jobs → `Jobs`

- [x] `src/app/(dashboard)/dashboard/jobs/[id]/page.tsx`
- [x] `src/app/(dashboard)/dashboard/jobs/new/page.tsx`
- [x] `src/components/jobs/job-context-menu.tsx`

### Cover Letters → `CoverLetters` (existing `coverLetters` keys preserved)

- [x] `src/app/(dashboard)/dashboard/cover-letters/page.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/[id]/page.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/_components/cover-letter-card.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/_components/cover-letter-list-empty.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/_components/cover-letter-list-skeleton.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/_components/cover-letters-filter-bar.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/_components/delete-cover-letter-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/page.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/cover-letter-wizard.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/step-1-job-source.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/step-2-settings.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/step-3-variants.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/wizard-loading.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/existing-cover-letter-dialog.tsx`
- [x] `src/app/(dashboard)/dashboard/cover-letters/generate/_components/missing-profile-dialog.tsx`

### Profile shared → `Profile.shared` (most tabs already migrated)

- [x] `src/app/(dashboard)/dashboard/profile/_components/tabs/_shared/entry-list.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/_components/tabs/_shared/sortable-entry-card.tsx`

### Subscriptions → `Subscriptions`

- [x] `src/app/(dashboard)/dashboard/subscriptions/[subscriptionId]/page.tsx`
- [x] `src/components/subscriptions/payment-method-details.tsx`
- [x] `src/components/subscriptions/payment-method-section.tsx`
- [x] `src/components/subscriptions/subscription-alerts.tsx`
- [x] `src/components/subscriptions/subscription-details.tsx`
- [x] `src/components/subscriptions/subscription-error-boundary.tsx`
- [x] `src/components/subscriptions/subscription-header.tsx`
- [x] `src/components/subscriptions/subscription-header-action-button.tsx`
- [x] `src/components/subscriptions/subscription-line-items.tsx`
- [x] `src/components/subscriptions/subscription-next-payment-card.tsx`
- [x] `src/components/subscriptions/subscription-past-payments-card.tsx`
- [x] `src/components/subscriptions/subscription-skeleton.tsx`

### Checkout → `Checkout`

- [x] `src/app/(checkout)/dashboard/checkout/[priceId]/Checkout.tsx`
- [x] `src/app/(checkout)/dashboard/checkout/[priceId]/page.tsx`
- [x] `src/app/(checkout)/dashboard/checkout/failure/page.tsx`
- [x] `src/app/(checkout)/dashboard/checkout/success/page.tsx`
- [x] `src/app/(checkout)/dashboard/checkout/layout.tsx`
- [x] `src/components/checkout/billing-toggle.tsx`
- [x] `src/components/checkout/checkout-contents.tsx`
- [x] `src/components/checkout/checkout-line-items.tsx`
- [x] `src/components/checkout/checkout-price-amount.tsx`
- [x] `src/components/checkout/checkout-price-container.tsx`
- [x] `src/components/checkout/price-section.tsx`

### Upgrade → existing `upgrade` namespace

- [x] `src/app/(checkout)/dashboard/upgrade/page.tsx`
- [x] `src/app/(checkout)/dashboard/upgrade/layout.tsx`
- [x] `src/components/upgrade/UpgradePage.tsx`
- [x] `src/components/upgrade/PricingCard.tsx`
- [x] `src/components/upgrade/BillingCycleToggle.tsx` (already partial)
- [x] `src/components/upgrade/ComparisonTable.tsx`
- [x] `src/components/upgrade/FaqAccordion.tsx`
- [x] `src/components/upgrade/TrustSection.tsx`

### Payments → `Payments`

- [x] `src/app/(dashboard)/dashboard/payments/page.tsx`
- [x] `src/components/payments/columns.tsx`
- [x] `src/components/payments/data-table.tsx`
- [x] `src/components/payments/payments-content.tsx`

### Settings → existing `settings` namespace

- [x] `src/app/(dashboard)/dashboard/settings/page.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/layout.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/_components/account-tab.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/_components/security-tab.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/_components/notifications-tab.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/_components/resume-tab.tsx`
- [x] `src/app/(dashboard)/dashboard/settings/_components/settings-tabs.tsx`

### Analytics → existing `analytics` namespace

- [x] `src/app/(dashboard)/dashboard/analytics/page.tsx`
- [x] `src/components/analytics/HeroStats.tsx`
- [x] `src/components/analytics/ApplicationsTimeline.tsx`
- [x] `src/components/analytics/ResumePerformance.tsx`
- [x] `src/components/analytics/ResponseTime.tsx`
- [x] `src/components/analytics/UpgradeOverlay.tsx`
- [x] `src/components/analytics/InsufficientDataState.tsx`
- [x] `src/components/analytics/ConversionFunnel.tsx`
- [x] `src/components/analytics/StatusBreakdown.tsx`
- [x] `src/components/analytics/AIOperationsBreakdown.tsx`
- [x] `src/components/analytics/AnalyticsErrorBoundary.tsx`
- [x] `src/components/analytics/StatCardSkeleton.tsx`

### Already migrated — Profile

- [x] all `src/app/(dashboard)/dashboard/profile/_components/tabs/*` except shared
- [x] `src/app/(dashboard)/dashboard/profile/_components/profile-shell.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/_components/profile-empty-state.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/_components/profile-tabs.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/_components/reset-profile-button.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/page.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/reupload/page.tsx`
- [x] `src/app/(dashboard)/dashboard/profile/reupload/_components/reupload-dropzone.tsx`

## Special cases

- **Pluralization**: dashboard summary line, count labels (cover letters, resumes,
  remaining credits) — handled via ICU `{count, plural, ...}`.
- **Rich text / links**: marketing landing CTA hero, register/login footer
  links, terms notice — handled via `t.rich` with `<link>` placeholders.
- **Zod schemas**: factored into factories that take `t` as input
  (`createLoginSchema(t)`).
- **Dynamic strings** (e.g. `relativeDate`): use `useFormatter().relativeTime`
  instead of hand-rolled "X days ago" strings.
- **Metadata** (`generateMetadata`): public landing, pricing — use
  `getTranslations`.

## Top-level namespaces (final)

```
Common
Errors
Notifications
Auth
Marketing
Pricing
Sidebar
DashboardShell
DashboardHome
Resumes
Jobs
Subscriptions
Checkout
Payments
upgrade        (preserved)
settings       (preserved)
analytics      (preserved)
profile        (preserved)
coverLetters   (preserved)
support        (preserved)
feedback       (preserved)
sidebar        (preserved)
app            (preserved)
```
