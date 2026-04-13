"use client";

import { Status } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { getPaymentReason } from "@/utils/paddle/data-helpers";
import { getTransactionInvoice } from "@/utils/paddle/get-transaction-invoice";
import { parseMoney } from "@/utils/paddle/parse-money";
import { Transaction } from "@paddle/paddle-node-sdk";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

// Column size is set as `auto` as React table column sizing is not working well.
const columnSize = "auto" as unknown as number;

function InvoiceDownloadButton({ transactionId }: { transactionId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    const url = await getTransactionInvoice(transactionId);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setLoading(false);
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleDownload} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}

export const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "billedAt",
    header: "Date",
    size: columnSize,
    cell: ({ row }) => {
      const billedDate = row.getValue("billedAt") as string;
      return billedDate ? dayjs(billedDate).format("MMM DD, YYYY [at] h:mma") : "-";
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right font-medium">Amount</div>,
    enableResizing: false,
    size: columnSize,
    cell: ({ row }) => {
      const formatted = parseMoney(row.original.details?.totals?.total, row.original.currencyCode);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    size: columnSize,
    cell: ({ row }) => {
      return <Status status={row.original.status} />;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    size: columnSize,
    cell: ({ row }) => {
      return (
        <div className={"max-w-[250px]"}>
          <div className={"flex gap-1 truncate whitespace-nowrap"}>
            <span className={"font-semibold"}>{getPaymentReason(row.original.origin)}</span>
            <span className={"truncate font-medium"}>
              {row.original.items[0].price?.description}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "invoice",
    header: "Invoice",
    size: columnSize,
    cell: ({ row }) => {
      if (!row.original.invoiceId) return null;
      return <InvoiceDownloadButton transactionId={row.original.id} />;
    },
  },
];
