import { CheckoutPriceAmount } from "@/components/checkout/checkout-price-amount";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBillingCycle } from "@/utils/paddle/data-helpers";
import { formatMoney } from "@/utils/paddle/parse-money";
import { CheckoutEventsData } from "@paddle/paddle-js/types/checkout/events";
import Image from "next/image";

interface Props {
  checkoutData: CheckoutEventsData | null;
}

export function CheckoutPriceContainer({ checkoutData }: Props) {
  const recurringTotal = checkoutData?.recurring_totals?.total;
  const billingCycle = checkoutData?.items.find((item) => item.billing_cycle)?.billing_cycle;
  return (
    <>
      {/* TODO: Replace with image when logo will be available */}
      <Image src="/assets/logo/lightrole-text.svg" width={300} height={150} alt="LightRole Logo" />
      {/* <h2>Light Role</h2> */}
      <div className={"mt-15 text-base leading-[20px] font-semibold"}>Order summary</div>
      <CheckoutPriceAmount checkoutData={checkoutData} />
      {recurringTotal !== undefined ? (
        billingCycle && (
          <div className={"text-muted-foreground pt-4 text-base leading-[20px] font-medium"}>
            then {formatMoney(recurringTotal, checkoutData?.currency_code)}{" "}
            {formatBillingCycle(billingCycle)}
          </div>
        )
      ) : (
        <Skeleton className="bg-border mt-4 h-[20px] w-full" />
      )}
    </>
  );
}
