import { Transaction } from "@paddle/paddle-node-sdk";
import dayjs from "dayjs";
import { ExternalLink, Gift, Receipt } from "lucide-react";
import Link from "next/link";

import { Status } from "@/components/shared/status";
import { Button } from "@/components/ui/button";

import { DASHBOARD_PAGES } from "@/constants/nav.constants";

import { getPaymentReason } from "@/utils/paddle/data-helpers";
import { parseMoney } from "@/utils/paddle/parse-money";

interface Props {
  subscriptionId: string;
  transactions?: Transaction[] | [];
}

export function SubscriptionPastPaymentsCard({ subscriptionId, transactions }: Props) {
  const isFreePlan = subscriptionId === "free";
  const hasTransactions = transactions && transactions.length > 0;

  return (
    <div data-slot="card" className="bg-card rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between border-b pb-5">
        <div className="flex items-center gap-2">
          <Receipt className="text-muted-foreground h-5 w-5" />
          <span className="text-lg font-bold">Payments</span>
        </div>
        {!isFreePlan && (
          <Button asChild={true} size="sm" variant="outline">
            <Link href={DASHBOARD_PAGES.PAYMENTS} className="flex items-center gap-1">
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
      <div>
        {isFreePlan ? (
          // Free plan - no payments
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <div className="bg-muted rounded-full p-3">
              <Gift className="text-muted-foreground h-8 w-8" />
            </div>
            <div className="text-center">
              <div className="text-foreground mb-2 text-lg font-semibold">No Payments Required</div>
              <div className="text-muted-foreground text-sm">
                Your free plan doesn&apos;t require any payments
              </div>
            </div>
          </div>
        ) : hasTransactions ? (
          // Paid plan with transactions
          <div className="divide-border divide-y">
            {transactions.slice(0, 3).map((transaction) => {
              const formattedPrice = parseMoney(
                transaction.details?.totals?.total,
                transaction.currencyCode
              );
              return (
                <div
                  key={transaction.id}
                  className="hover:bg-muted/40 flex flex-col gap-4 py-5 transition-colors"
                >
                  <div className="text-muted-foreground text-sm">
                    {dayjs(transaction.billedAt ?? transaction.createdAt).format("MMM DD, YYYY")}
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <span className="text-foreground text-sm font-semibold">
                      {getPaymentReason(transaction.origin)}
                    </span>
                    <span className="text-sm">{transaction.items[0].price?.name} Plan</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="bg-muted rounded-md px-2 py-1 text-sm font-semibold">
                      {formattedPrice}
                    </div>
                    <Status status={transaction.status} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Paid plan with no transactions
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <div className="text-center">
              <div className="text-foreground mb-2 text-lg font-semibold">No Payment History</div>
              <div className="text-muted-foreground text-sm">
                No payments have been processed yet
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
