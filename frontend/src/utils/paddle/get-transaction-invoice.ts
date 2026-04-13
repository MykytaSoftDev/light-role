"use server";

import { getPaddleInstance } from "./get-paddle-instance";

export async function getTransactionInvoice(transactionId: string): Promise<string | null> {
  try {
    const result = await getPaddleInstance().transactions.getInvoicePDF(transactionId);
    return result.url;
  } catch {
    return null;
  }
}
