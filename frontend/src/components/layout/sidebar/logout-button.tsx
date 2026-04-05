'use client'

import { useMutation } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { AUTH_PAGES } from '@/constants/nav.constants'

import { logout } from '@/lib/user'

export default function LogoutButton() {
	const router = useRouter()

	const { mutate } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => logout(),
		onSuccess: () => router.push(AUTH_PAGES.LOGIN)
	})

	return (
		<DropdownMenuItem onClick={() => mutate()}>
			<LogOut />
			Log out
		</DropdownMenuItem>
	)
}
