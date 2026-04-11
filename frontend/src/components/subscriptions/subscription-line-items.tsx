import { Subscription } from "@paddle/paddle-node-sdk";
import { Gift, Package, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";

import { FreePlan } from "@/lib/paddle/api";

import { parseMoney } from "@/utils/paddle/parse-money";

interface Props {
  subscription?: Subscription | FreePlan;
}

export function SubscriptionLineItems({ subscription }: Props) {
  const isFreePlan = subscription?.id === "free";
  const hasRecurringDetails = subscription?.recurringTransactionDetails && !isFreePlan;

  return (
    <div data-slot="card" className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-2">
          <Package className="text-muted-foreground h-5 w-5" />
          <span className="text-lg font-bold">
            {isFreePlan ? "Free Plan Details" : "Recurring products in this subscription"}
          </span>
        </div>
      </div>
      <div className="pt-6">
        {isFreePlan ? (
          // Free plan display
          <div className="flex flex-col items-center justify-center space-y-6 py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-muted rounded-full p-3">
                <Gift className="text-muted-foreground h-8 w-8" />
              </div>
              <div className="text-center">
                <div className="text-foreground mb-2 text-xl font-semibold">Free Plan</div>
                <div className="text-muted-foreground text-base">
                  Enjoy basic features at no cost
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-foreground mb-2 text-3xl font-bold">$0.00</div>
              <div className="text-muted-foreground text-sm">No recurring charges</div>
            </div>
          </div>
        ) : (
          // Paid subscription display
          <div className="grid grid-cols-12">
            <div className="col-span-6"></div>
            <div className="col-span-6 flex w-full gap-6">
              <div className="text-foreground col-span-2 w-full text-sm font-semibold">Qty</div>
              <div className="text-foreground col-span-2 w-full text-sm font-semibold">Tax</div>
              <div className="text-foreground col-span-2 w-full text-right text-sm font-semibold">
                <span>Amount</span>
                <span className="text-muted-foreground ml-1 text-sm font-normal">(exc. tax)</span>
              </div>
            </div>
            {hasRecurringDetails &&
              subscription?.recurringTransactionDetails?.lineItems.map((lineItem) => {
                return (
                  <Fragment key={lineItem.priceId}>
                    <div className="border-border group col-span-6 border-b py-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {lineItem.product.imageUrl ? (
                            <div className="bg-muted rounded-md p-1">
                              <Image
                                src={lineItem.product.imageUrl}
                                width={48}
                                height={48}
                                alt={lineItem.product.name}
                                className="rounded-sm"
                              />
                            </div>
                          ) : (
                            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                              <ShoppingCart className="text-muted-foreground h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 px-4">
                          <div className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                            {subscription.items[0].price.name} Plan
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {subscription.items[0].price.description}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border-border col-span-6 flex w-full items-center gap-6 border-b py-6">
                      <div className="bg-muted col-span-2 w-full rounded-md px-2 py-1 text-center text-sm font-semibold">
                        {lineItem.quantity}
                      </div>
                      <div className="bg-muted col-span-2 w-full rounded-md px-2 py-1 text-center text-sm font-semibold">
                        {parseFloat(lineItem.taxRate) * 100}%
                      </div>
                      <div className="bg-muted col-span-2 w-full rounded-md px-2 py-1 text-right text-sm font-semibold">
                        {parseMoney(lineItem.totals.subtotal, subscription?.currencyCode)}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            {hasRecurringDetails && (
              <>
                <div className="col-span-6"></div>
                <div className="col-span-6 flex w-full flex-col pt-6">
                  <div className="border-border flex justify-between border-b py-4 pt-0">
                    <div className="text-muted-foreground col-span-3 w-full text-sm">Amount</div>
                    <div className="col-span-3 w-full text-right text-sm">
                      {parseMoney(
                        subscription?.recurringTransactionDetails?.totals.subtotal,
                        subscription?.currencyCode
                      )}
                    </div>
                  </div>
                  <div className="border-border flex justify-between border-b py-4">
                    <div className="text-muted-foreground col-span-3 w-full text-sm">Tax</div>
                    <div className="col-span-3 w-full text-right text-sm">
                      {parseMoney(
                        subscription?.recurringTransactionDetails?.totals.tax,
                        subscription?.currencyCode
                      )}
                    </div>
                  </div>
                  <div className="bg-muted/60 flex justify-between rounded-md px-3 py-4">
                    <div className="col-span-3 w-full text-sm font-medium">Total (Inc. tax)</div>
                    <div className="text-foreground col-span-3 w-full text-right text-sm font-semibold">
                      {parseMoney(
                        subscription?.recurringTransactionDetails?.totals.total,
                        subscription?.currencyCode
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
