"use server";

import { SubscriptionDetailResponse } from "@/lib/paddle/api";
import { ErrorMessage, parseSDKResponse } from "@/utils/paddle/data-helpers";
import { getPaddleInstance } from "@/utils/paddle/get-paddle-instance";

export async function getSubscription(subscriptionId: string): Promise<SubscriptionDetailResponse> {
  try {
    const subscription = await getPaddleInstance().subscriptions.get(subscriptionId, {
      include: ["next_transaction", "recurring_transaction_details"],
    });
    return { data: parseSDKResponse(subscription) };
  } catch {
    return { error: ErrorMessage };
  }
}
