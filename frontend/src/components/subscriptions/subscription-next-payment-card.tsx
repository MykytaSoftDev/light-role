import { Subscription, Transaction } from "@paddle/paddle-node-sdk";
import dayjs from "dayjs";
import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";

import { PaymentMethodSection } from "@/components/subscriptions/payment-method-section";

import { FreePlan } from "@/lib/paddle/api";

import { parseMoney } from "@/utils/paddle/parse-money";

interface Props {
  transactions?: Transaction[] | [];
  subscription?: Subscription | FreePlan;
}

export function SubscriptionNextPaymentCard({ subscription, transactions }: Props) {
  const t = useTranslations("Subscriptions.nextPayment");
  // Don't show next payment card for free plans or if no next billing date
  if (!subscription?.nextBilledAt || subscription.id === "free") {
    return null;
  }

  return (
    <div data-slot="card" className="bg-card rounded-xl border p-6">
      <div className="border-b pb-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="text-muted-foreground h-5 w-5" />
          <h3 className="text-lg font-bold">{t("title")}</h3>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-foreground text-2xl font-bold">
            {parseMoney(
              subscription?.nextTransaction?.details.totals.total,
              subscription?.currencyCode
            )}
          </span>
          <span className="text-muted-foreground text-sm">
            {t("dueLabel", { date: dayjs(subscription?.nextBilledAt).format("MMM DD, YYYY") })}
          </span>
        </div>
      </div>
      <PaymentMethodSection
        transactions={transactions}
        updatePaymentMethodUrl={subscription?.managementUrls?.updatePaymentMethod}
      />
    </div>
  );
}
