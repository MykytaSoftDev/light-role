import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetProfile, type ProfileResponse } from "@/lib/profile-api";
import { queryKeys } from "./keys";

export function useResetProfile() {
  const queryClient = useQueryClient();
  return useMutation<ProfileResponse, Error, File>({
    mutationFn: (file) => resetProfile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
}
