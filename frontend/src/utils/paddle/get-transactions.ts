"use server";

import { TransactionResponse } from "@/lib/paddle/api";
import { getErrorMessage, parseSDKResponse } from "@/utils/paddle/data-helpers";
import { getPaddleInstance } from "@/utils/paddle/get-paddle-instance";

export async function getTransactions(
  subscriptionId: string
): Promise<TransactionResponse> {
  try {
    const transactionCollection = getPaddleInstance().transactions.list({
      subscriptionId: [subscriptionId],
      perPage: 10,
      status: ["billed", "paid", "past_due", "completed", "canceled"],
    });
    const transactionData = await transactionCollection.next();
    return {
      data: parseSDKResponse(transactionData ?? []),
      hasMore: transactionCollection.hasMore,
      totalRecords: transactionCollection.estimatedTotal,
    };
  } catch (e) {
    return getErrorMessage();
  }
}
