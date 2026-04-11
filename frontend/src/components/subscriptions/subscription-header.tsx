import { Subscription } from "@paddle/paddle-node-sdk";
import dayjs from "dayjs";
import Image from "next/image";

import { Status } from "@/components/shared/status";
import { SubscriptionAlerts } from "@/components/subscriptions/subscription-alerts";
import { SubscriptionHeaderActionButton } from "@/components/subscriptions/subscription-header-action-button";

import { FreePlan } from "@/lib/paddle/api";

import { parseMoney } from "@/utils/paddle/parse-money";

interface Props {
  subscription: Subscription | FreePlan;
}

export function SubscriptionHeader({ subscription }: Props) {
  const subscriptionItem = subscription.items[0];
  const isFreePlan = subscription.id === "free";

  // Handle pricing display for free vs paid plans
  const getPriceDisplay = () => {
    if (isFreePlan) {
      return {
        price: "0",
        formattedPrice: "$0.00",
        frequency: "/month",
      };
    }

    const price =
      subscriptionItem.quantity *
      parseFloat(subscription?.recurringTransactionDetails?.totals.total ?? "0");
    const formattedPrice = parseMoney(price.toString(), subscription.currencyCode);
    const frequency =
      subscription.billingCycle.frequency === 1
        ? `/${subscription.billingCycle.interval.toLowerCase()}`
        : `every ${subscription.billingCycle.frequency} ${subscription.billingCycle.interval.toLowerCase()}s`;

    return {
      price: price.toString(),
      formattedPrice,
      frequency,
    };
  };

  const { formattedPrice, frequency } = getPriceDisplay();
  const formattedStartedDate = dayjs(subscription.startedAt).format("MMM DD, YYYY");

  return (
    <div data-slot="card" className="bg-card rounded-xl border p-6">
      <SubscriptionAlerts subscription={subscription} />
      <div className="flex flex-col gap-6">
        {/* Top: plan info + action */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {subscriptionItem.product.imageUrl && (
              <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                <Image
                  src={subscriptionItem.product.imageUrl}
                  alt={subscriptionItem.price.name || "Plan"}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h2 className="text-foreground text-2xl font-bold">
                {subscriptionItem.price.name} Plan
              </h2>
              <p className="text-muted-foreground text-sm">Started {formattedStartedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Status status={subscription.status} />
            {!isFreePlan &&
              !(subscription.scheduledChange || subscription.status === "canceled") && (
                <SubscriptionHeaderActionButton subscriptionId={subscription.id} />
              )}
          </div>
        </div>
        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-foreground text-3xl font-bold">{formattedPrice}</span>
          <span className="text-muted-foreground text-sm">{frequency}</span>
        </div>
      </div>
    </div>
  );
}
