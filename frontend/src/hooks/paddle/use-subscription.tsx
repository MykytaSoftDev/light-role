"use client";

import { useEffect, useState } from "react";

import {
  FreeSubscription,
  FreeTransactionData,
  SubscriptionDetailResponse,
  TransactionResponse,
} from "@/lib/paddle/api";

import { getSubscription } from "@/utils/paddle/get-subscription";
import { getTransactions } from "@/utils/paddle/get-transactions";

import { useProfile } from "@/hooks/use-profile";

interface UseSubscriptionReturn {
  subscription: SubscriptionDetailResponse | FreeSubscription | null;
  transactions: TransactionResponse | FreeTransactionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const createFreeSubscription = (createdAt?: string): FreeSubscription => ({
  data: {
    id: "free",
    items: [
      {
        id: "free",
        quantity: 1,
        product: {
          imageUrl: "/assets/icons/free-icon.svg",
        },
        price: {
          name: "Free",
        },
      },
    ],
    recurringTransactionDetails: null,
    billingCycle: {
      interval: "MONTHLY",
      frequency: 1,
    },
    currencyCode: "USD",
    managementUrls: null,
    startedAt: createdAt || new Date().toISOString(),
    status: "active",
    scheduledChange: null,
    nextBilledAt: undefined,
  },
});

const createFreeTransactionData = (): FreeTransactionData => ({
  data: [],
});

export function useSubscription(subscriptionId: string): UseSubscriptionReturn {
  console.log("subscriptionId", subscriptionId);

  const [subscription, setSubscription] = useState<
    SubscriptionDetailResponse | FreeSubscription | null
  >(null);
  const [transactions, setTransactions] = useState<
    TransactionResponse | FreeTransactionData | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: userData, isLoading: userLoading } = useProfile();
  console.log("userData", userData);
  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (subscriptionId === "free") {
        setSubscription(createFreeSubscription(userData?.created_at));
        setTransactions(createFreeTransactionData());
        setLoading(false);
        return;
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Paddle API timeout - please try again")), 10000)
      );

      const [subscriptionResponse, transactionsResponse] = (await Promise.race([
        Promise.all([getSubscription(subscriptionId), getTransactions(subscriptionId)]),
        timeoutPromise,
      ])) as [SubscriptionDetailResponse, TransactionResponse];

      if (subscriptionResponse?.data) {
        setSubscription(subscriptionResponse);
      } else {
        setError("Failed to fetch subscription data from Paddle");
      }

      if (transactionsResponse?.data) {
        setTransactions(transactionsResponse);
      } else {
        setTransactions({ data: [] });
      }
    } catch (err) {
      console.error("Error fetching subscription data:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch subscription data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoading) {
      fetchSubscriptionData();
    }
  }, [subscriptionId, userLoading]);

  const refetch = () => {
    fetchSubscriptionData();
  };

  return {
    subscription,
    transactions,
    loading: userLoading || loading,
    error,
    refetch,
  };
}
