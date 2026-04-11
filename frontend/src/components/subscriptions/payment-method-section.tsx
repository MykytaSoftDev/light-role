import { PaymentMethodDetails } from "@/components/subscriptions/payment-method-details";
import { Button } from "@/components/ui/button";
import { PaymentType, Transaction } from "@paddle/paddle-node-sdk";
import { CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";

function findPaymentMethodDetails(transactions?: Transaction[]) {
  const transactionWithPaymentDetails = transactions?.find(
    (transaction) => transaction.payments[0]?.methodDetails
  );
  const firstValidPaymentMethod = transactionWithPaymentDetails?.payments[0].methodDetails;
  return firstValidPaymentMethod
    ? firstValidPaymentMethod
    : { type: "unknown" as PaymentType, card: null };
}

interface Props {
  updatePaymentMethodUrl?: string | null;
  transactions?: Transaction[];
}

export function PaymentMethodSection({ transactions, updatePaymentMethodUrl }: Props) {
  const { type, card } = findPaymentMethodDetails(transactions);
  if (type === "unknown") {
    return null;
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-medium whitespace-nowrap">Payment method</div>
        </div>
        <div className="bg-muted flex items-center gap-2 rounded-md px-3 py-2">
          <PaymentMethodDetails type={type} card={card} />
        </div>
      </div>
      {updatePaymentMethodUrl && (
        <div>
          <Button asChild={true} size="sm" variant="outline">
            <Link
              target="_blank"
              href={updatePaymentMethodUrl}
              className="flex items-center gap-1"
            >
              Update
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
