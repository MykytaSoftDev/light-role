import { Subscription } from "@paddle/paddle-node-sdk";
import dayjs from "dayjs";
import { AlertCircleIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";

import { FreePlan } from "@/lib/paddle/api";

interface Props {
  subscription: Subscription | FreePlan;
}

export function SubscriptionAlerts({ subscription }: Props) {
  const isFreePlan = subscription.id === "free";

  // Don't show cancellation alerts for free plans
  if (isFreePlan) {
    return null;
  }

  if (subscription.status === "canceled") {
    return (
      <Alert variant={"destructive"} className={"mb-10 w-full"}>
        <AlertCircleIcon />
        This subscription was canceled on{" "}
        {dayjs(subscription.canceledAt).format("MMM DD, YYYY [at] h:mma")} and is no longer active.
      </Alert>
    );
  } else if (subscription.scheduledChange && subscription.scheduledChange.action === "cancel") {
    return (
      <Alert className={"mb-5 w-full"}>
        <AlertCircleIcon />
        This subscription is scheduled to be canceled on{" "}
        {dayjs(subscription.scheduledChange.effectiveAt).format("MMM DD, YYYY [at] h:mma")}
      </Alert>
    );
  }
  return null;
}
