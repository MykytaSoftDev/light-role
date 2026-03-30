'use client'

import { CheckoutGradients } from '@/components/gradients/checkout-gradients';
import '@/styles/checkout.css';
import { CheckoutHeader } from '@/components/checkout/checkout-header';
import { CheckoutContents } from '@/components/checkout/checkout-contents';
import { useProfile } from '@/hooks/use-profile'

import { useState } from 'react';

export function Checkout() {
  const { data, isLoading } = useProfile()

	return (
		<div className={'w-full min-h-screen relative overflow-hidden'}>
			<CheckoutGradients />
			<div
				className={'mx-auto max-w-6xl relative px-[16px] md:px-[32px] py-[24px] flex flex-col gap-6 justify-between'}
			>
				<CheckoutHeader />
				<CheckoutContents userEmail={data?.email} />
			</div>
		</div>
	);
}