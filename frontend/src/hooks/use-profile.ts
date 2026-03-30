import { getUserData } from "@/lib/user"
import { useQuery } from "@tanstack/react-query"

export function useProfile() {
	const { data, isLoading } = useQuery({
		queryKey: ['profile'],
		queryFn: () => getUserData(),
		staleTime: 1000 * 60 * 5
	})

	return { data, isLoading }
}