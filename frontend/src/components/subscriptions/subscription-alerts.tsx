import { Subscription } from "@paddle/paddle-node-sdk";
import dayjs from "dayjs";
import { AlertCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";

import { FreePlan } from "@/lib/paddle/api";

interface Props {
  subscription: Subscription | FreePlan;
}

export function SubscriptionAlerts({ subscription }: Props) {
  const t = useTranslations("Subscriptions.alerts");
  const isFreePlan = subscription.id === "free";

  // Don't show cancellation alerts for free plans
  if (isFreePlan) {
    return null;
  }

  if (subscription.status === "canceled") {
    return (
      <Alert variant={"destructive"} className={"mb-10 w-full"}>
        <AlertCircleIcon />
        {t("canceledOnAt", {
          date: dayjs(subscription.canceledAt).format("MMM DD, YYYY [at] h:mma"),
        })}
      </Alert>
    );
  } else if (subscription.scheduledChange && subscription.scheduledChange.action === "cancel") {
    return (
      <Alert className={"mb-5 w-full"}>
        <AlertCircleIcon />
        {t("canceledBody", {
          date: dayjs(subscription.scheduledChange.effectiveAt).format("MMM DD, YYYY [at] h:mma"),
        })}
      </Alert>
    );
  }
  return null;
}
