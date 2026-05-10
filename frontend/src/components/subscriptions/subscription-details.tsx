"use client";

import { ErrorContent } from "@/components/layout/error-content";
import { SubscriptionHeader } from "@/components/subscriptions/subscription-header";
import { SubscriptionLineItems } from "@/components/subscriptions/subscription-line-items";
import { SubscriptionNextPaymentCard } from "@/components/subscriptions/subscription-next-payment-card";
import { SubscriptionPastPaymentsCard } from "@/components/subscriptions/subscription-past-payments-card";
import { SubscriptionSkeleton } from "@/components/subscriptions/subscription-skeleton";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

import { useSubscription } from "@/hooks/paddle/use-subscription";

interface Props {
  subscriptionId: string;
}

export function SubscriptionDetail({ subscriptionId }: Props) {
  const { subscription, transactions, loading, error, refetch } = useSubscription(subscriptionId);
  const tErr = useTranslations("Subscriptions.errorBoundary");
  const tCommon = useTranslations("Common");

  // Show loading skeleton while fetching data
  if (loading) {
    return <SubscriptionSkeleton />;
  }

  // Show error if there's an error
  if (error) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4">
          <div className="text-center">
            <h3 className="text-foreground mb-2 text-lg font-semibold">
              {tErr("title")}
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refetch} variant="default">
              {tCommon("actions.tryAgain")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show subscription details if data is available
  if (subscription?.data && transactions?.data !== undefined) {
    return (
      <div className="space-y-6">
        <SubscriptionHeader subscription={subscription.data} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-6">
          <div className="space-y-6 xl:col-span-2">
            <SubscriptionNextPaymentCard
              transactions={transactions.data}
              subscription={subscription.data}
            />
            <SubscriptionPastPaymentsCard
              transactions={transactions.data}
              subscriptionId={subscriptionId}
            />
          </div>
          <div className="xl:col-span-4">
            <SubscriptionLineItems subscription={subscription.data} />
          </div>
        </div>
      </div>
    );
  }

  // Fallback error
  return <ErrorContent />;
}
