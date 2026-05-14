"use client";

import { formatDistanceToNow } from "date-fns";
import { Chrome, Mail, UserCheck } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useImpersonate } from "@/hooks/api/useAdmin";
import type { AdminUserCounts, AdminUserListItem } from "@/hooks/api/useAdmin";

import { ConfirmActionModal } from "./confirm-action-modal";

// Mirrors the sessionStorage keys read by `<ImpersonationBanner />`. These
// are the bridge that lets the banner — which doesn't otherwise know which
// user the admin was viewing — return them to the right detail page on exit
// and compute the 60-min token expiry countdown.
const SS_TARGET_KEY = "impersonation_target_id";
const SS_STARTED_KEY = "impersonation_started_at";

interface AdminUserProfileCardProps {
  user: AdminUserListItem;
  counts: AdminUserCounts;
}

function initialsFor(user: AdminUserListItem): string {
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  if (first || last) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
  }
  return user.email.slice(0, 2).toUpperCase();
}

function RelativeWithAbsolute({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const date = new Date(iso);
  return (
    <div className="flex flex-col">
      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
      <span className="text-xs text-muted-foreground">
        {date.toLocaleString()}
      </span>
    </div>
  );
}

function CountTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function AdminUserProfileCard({
  user,
  counts,
}: AdminUserProfileCardProps) {
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed user";

  const isGoogle = user.auth_provider === "google";

  // SPEC §6.4: target admins are blocked at the API layer (400). Mirror it in
  // the UI by disabling the button and explaining why on hover.
  const impersonateDisabled = user.is_admin;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const impersonate = useImpersonate();

  const handleConfirm = () => {
    impersonate.mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          // Stamp sessionStorage BEFORE the reload so the banner has the
          // context it needs to drive the countdown and the eventual return
          // navigation on exit (see <ImpersonationBanner />).
          window.sessionStorage.setItem(SS_TARGET_KEY, user.id);
          window.sessionStorage.setItem(
            SS_STARTED_KEY,
            Date.now().toString()
          );
          // Full reload — TanStack Query cache, providers, and any local
          // user-bound state must rebuild for the impersonated identity
          // (SPEC §6.4 + §9 "Frontend cache invalidation").
          window.location.href = "/dashboard";
        },
      }
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) impersonate.reset();
    setConfirmOpen(next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {initialsFor(user)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg">{fullName}</CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1">
            {isGoogle ? (
              <>
                <Chrome className="h-3 w-3" /> Google
              </>
            ) : (
              <>
                <Mail className="h-3 w-3" /> Email
              </>
            )}
          </Badge>
          {user.is_verified ? (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Verified
            </Badge>
          ) : (
            <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Unverified
            </Badge>
          )}
          {user.is_admin && (
            <Badge className="border-primary/20 bg-primary/10 text-primary">
              Admin
            </Badge>
          )}
        </div>

        <Separator className="my-4" />

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Created</dt>
          <dd>
            <RelativeWithAbsolute iso={user.created_at} />
          </dd>
          <dt className="text-muted-foreground">Last login</dt>
          <dd>
            <RelativeWithAbsolute iso={user.last_login_at} />
          </dd>
          <dt className="text-muted-foreground">User ID</dt>
          <dd>
            <code className="break-all text-xs">{user.id}</code>
          </dd>
        </dl>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 gap-3">
          <CountTile value={counts.jobs} label="Jobs" />
          <CountTile value={counts.resumes} label="Resumes" />
          <CountTile value={counts.cover_letters} label="Cover letters" />
          <CountTile value={counts.feedbacks} label="Feedback" />
        </div>

        <Separator className="my-4" />

        {impersonateDisabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="block w-full">
                <Button className="w-full" disabled>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Impersonate user
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Cannot impersonate another admin</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            className="w-full"
            onClick={() => setConfirmOpen(true)}
            disabled={impersonate.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Impersonate user
          </Button>
        )}
      </CardContent>

      {/* ── Impersonation confirm modal ──────────────────────────────────── */}
      <ConfirmActionModal
        open={confirmOpen}
        onOpenChange={handleOpenChange}
        icon={UserCheck}
        iconClassName="text-primary"
        actionName="Impersonate user"
        targetEmail={user.email}
        description="You will act as this user. Money-touching and destructive actions will be blocked. Your session will auto-expire in 60 minutes."
        confirmLabel="Start impersonation"
        confirmVariant="default"
        isPending={impersonate.isPending}
        errorMessage={impersonate.error?.message ?? null}
        onConfirm={handleConfirm}
      />
    </Card>
  );
}
