import { CheckoutPriceAmount } from '@/components/checkout/checkout-price-amount';
import { CheckoutEventsData } from '@paddle/paddle-js/types/checkout/events';
import { formatMoney } from '@/utils/paddle/parse-money';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBillingCycle } from '@/utils/paddle/data-helpers';
import Image from 'next/image'

interface Props {
	checkoutData: CheckoutEventsData | null;
}

export function CheckoutPriceContainer({ checkoutData }: Props) {
	const recurringTotal = checkoutData?.recurring_totals?.total;
	const billingCycle = checkoutData?.items.find((item) => item.billing_cycle)?.billing_cycle;
	return (
		<>
			<Image src="/deep.svg" width={300} height={150} alt="DeepolyGo Logo"/>
			<div className={'text-base leading-[20px] font-semibold mt-15'}>Order summary</div>
			<CheckoutPriceAmount checkoutData={checkoutData} />
			{recurringTotal !== undefined ? (
				billingCycle && (
					<div className={'pt-4 text-base leading-[20px] font-medium text-muted-foreground'}>
						then {formatMoney(recurringTotal, checkoutData?.currency_code)} {formatBillingCycle(billingCycle)}
					</div>
				)
			) : (
				<Skeleton className="mt-4 h-[20px] w-full bg-border" />
			)}
		</>
	);
}