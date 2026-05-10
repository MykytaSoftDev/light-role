"use client";

import { Skeleton } from '@/components/ui/skeleton';
import { CheckoutEventsData } from '@paddle/paddle-js/types/checkout/events';
import { formatMoney } from '@/utils/paddle/parse-money';
import { useTranslations } from 'next-intl';

interface Props {
	checkoutData: CheckoutEventsData | null;
}

export function CheckoutPriceAmount({ checkoutData }: Props) {
	const t = useTranslations('Checkout.lineItems');
	const total = checkoutData?.totals.total;
	return (
		<>
			{total !== undefined ? (
				<div className={'pt-8 flex gap-2 items-end'}>
					<span className={'text-5xl'}>{formatMoney(total, checkoutData?.currency_code)}</span>
					<span className={'text-base leading-[16px]'}>{t('includingTax')}</span>
				</div>
			) : (
				<Skeleton className="mt-8 h-[48px] w-full bg-border" />
			)}
		</>
	);
}