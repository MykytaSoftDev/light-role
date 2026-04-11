"use server";

import { getPaddleInstance } from "@/utils/paddle/get-paddle-instance";
import { Subscription } from "@paddle/paddle-node-sdk";
import { revalidatePath } from "next/cache";

const paddle = getPaddleInstance();

interface Error {
  error: string;
}

export async function cancelSubscription(subscriptionId: string): Promise<Subscription | Error> {
  try {
    const subscription = await paddle.subscriptions.cancel(subscriptionId, {
      effectiveFrom: "next_billing_period",
    });
    if (subscription) {
      revalidatePath("/");
    }
    return JSON.parse(JSON.stringify(subscription));
  } catch (e) {
    console.log("Error canceling subscription", e);
    return { error: "Something went wrong, please try again later" };
  }
}
