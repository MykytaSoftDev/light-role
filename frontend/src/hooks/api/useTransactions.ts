import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  invoice_url?: string | null;
  [key: string]: unknown;
}

interface TransactionsResponse {
  items: Transaction[];
  has_more: boolean;
  next_cursor: string | null;
}

interface UseTransactionsOptions {
  perPage?: number;
  after?: string;
}

async function getTransactions(perPage: number, after?: string): Promise<TransactionsResponse> {
  const url = after
    ? `/api/v1/subscriptions/transactions?per_page=${perPage}&after=${after}`
    : `/api/v1/subscriptions/transactions?per_page=${perPage}`;
  const res = await api.get(url);
  if (!res.ok) throw new Error(`Failed to fetch transactions: HTTP ${res.status}`);
  return res.json();
}

export function useTransactions({ perPage = 10, after }: UseTransactionsOptions = {}) {
  return useQuery<TransactionsResponse>({
    queryKey: ["user", "transactions", { perPage, after }],
    queryFn: () => getTransactions(perPage, after),
    staleTime: 1000 * 60 * 5,
  });
}
