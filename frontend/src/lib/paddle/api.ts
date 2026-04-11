import { Subscription, SubscriptionPreview, Transaction } from "@paddle/paddle-node-sdk";

export interface SubscriptionResponse {
  data?: Subscription[];
  hasMore: boolean;
  totalRecords: number;
  error?: string;
}

export interface TransactionResponse {
  data?: Transaction[];
  hasMore: boolean;
  totalRecords: number;
  error?: string;
}

export interface SubscriptionDetailResponse {
  data?: Subscription;
  error?: string;
}

export interface SubscriptionPreviewResponse {
  data?: SubscriptionPreview;
  error?: string;
}

export interface FreeTransactionData {
  data: [];
}

export interface FreeSubscription {
  data: FreePlan;
}

export interface FreePlan {
  id: string;
  items: PlanItem[];
  recurringTransactionDetails: null;
  billingCycle: {
    interval: "MONTHLY" | "YEARLY";
    frequency: number;
  };
  currencyCode: string;
  startedAt: string;
  status: string;
  scheduledChange: {
    action: string;
    effectiveAt: string;
  } | null;
  canceledAt?: string;
  nextBilledAt?: string;
  nextTransaction?: null;
  managementUrls: null;
}

export interface PlanItem {
  id: string;
  quantity: number;
  product: {
    imageUrl: string;
  };
  price: {
    name: string;
  };
}
