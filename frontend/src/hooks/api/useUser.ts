import { useQuery } from "@tanstack/react-query";
import { getUserData } from "@/lib/user";
import type { CurrentUser } from "@/lib/user";
import { queryKeys } from "./keys";

export function useUser() {
  return useQuery<CurrentUser>({
    queryKey: queryKeys.user.me,
    queryFn: getUserData,
    staleTime: 1000 * 60 * 5,
  });
}
