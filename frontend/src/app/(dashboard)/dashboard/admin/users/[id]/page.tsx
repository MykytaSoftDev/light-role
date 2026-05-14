"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";

import { useAdminUser } from "@/hooks/api/useAdmin";

import { AdminAuditLogList } from "../../_components/admin-audit-log-list";
import { AdminSubscriptionCard } from "../../_components/admin-subscription-card";
import { AdminUserProfileCard } from "../../_components/admin-user-profile-card";

export default function AdminUserDetailPage() {
  // Next.js 15 — useParams() is a sync hook, no need to `use()` a Promise.
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const query = useAdminUser(userId);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
        >
          <Link href={DASHBOARD_PAGES.ADMIN_USERS}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to users
          </Link>
        </Button>

        {query.isLoading && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-72" />
          </div>
        )}

        {query.data && (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {query.data.user.email}
            </h1>
            {query.data.user.is_admin && (
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                Admin
              </Badge>
            )}
            {query.data.user.is_verified ? (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Verified
              </Badge>
            ) : (
              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Unverified
              </Badge>
            )}
          </div>
        )}
      </div>

      {query.isError && (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load user</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {query.error?.message ??
                "Something went wrong loading this user. They may have been deleted."}
            </p>
          </CardContent>
        </Card>
      )}

      {query.isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        </div>
      )}

      {query.data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <AdminUserProfileCard
              user={query.data.user}
              counts={query.data.counts}
            />
          </div>
          <div className="lg:col-span-4">
            <AdminSubscriptionCard
              userId={query.data.user.id}
              userEmail={query.data.user.email}
              subscription={query.data.subscription}
              usage={query.data.usage}
              lifetimeUsage={query.data.lifetime_usage}
            />
          </div>
          <div className="lg:col-span-3">
            <AdminAuditLogList targetUserId={query.data.user.id} pageSize={10} />
          </div>
        </div>
      )}
    </div>
  );
}
