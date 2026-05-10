"use client";

import { ErrorContent } from "@/components/layout/error-content";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { useColumns } from "@/components/payments/columns";
import { DataTable } from "@/components/payments/data-table";
import { usePagination } from "@/hooks/use-pagination";
import { usePlan } from "@/hooks/use-plan";
import { TransactionResponse } from "@/lib/paddle/api";
import { getTransactions } from "@/utils/paddle/get-transactions";
import { useEffect, useState } from "react";

export function PaymentsContent() {
  const { after, goToNextPage, goToPrevPage, hasPrev } = usePagination();
  const { subscriptionId, isLoading: planLoading } = usePlan();
  const columns = useColumns();

  const [transactionResponse, setTransactionResponse] = useState<TransactionResponse>({
    data: [],
    hasMore: false,
    totalRecords: 0,
    error: undefined,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (planLoading) return;

    if (!subscriptionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const response = await getTransactions(subscriptionId);
      if (cancelled) return;
      if (response) setTransactionResponse(response);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [subscriptionId, planLoading, after]);

  if (!transactionResponse || transactionResponse.error) {
    return <ErrorContent />;
  } else if (loading) {
    return <LoadingScreen />;
  }
  const { data: transactionData, hasMore, totalRecords } = transactionResponse;
  return (
    <div className="px-5">
      <DataTable
        columns={columns}
        hasMore={hasMore}
        totalRecords={totalRecords}
        goToNextPage={goToNextPage}
        goToPrevPage={goToPrevPage}
        hasPrev={hasPrev}
        data={transactionData ?? []}
      />
    </div>
  );
}
