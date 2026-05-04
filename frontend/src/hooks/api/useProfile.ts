import { useQuery } from "@tanstack/react-query";
import { getProfile, type ProfileResponse } from "@/lib/profile-api";
import { queryKeys } from "./keys";

export function useProfile() {
  return useQuery<ProfileResponse>({
    queryKey: queryKeys.profile.all,
    queryFn: getProfile,
    staleTime: 1000 * 60 * 2,
  });
}
