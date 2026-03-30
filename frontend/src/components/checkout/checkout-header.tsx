import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { DASHBOARD_PAGES } from '@/constants/nav.constants'

export function CheckoutHeader() {
	return (
		<div className={'flex gap-4'}>
			<Link href={DASHBOARD_PAGES.SUBSCRIPTIONS}>
				<Button variant={'secondary'} className={'h-[32px] hover:cursor-pointer border-border w-[32px] p-0 rounded-[4px]'}>
					<ChevronLeft />
				</Button>
			</Link>
		</div>
	);
}