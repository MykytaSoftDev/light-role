import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  patchProfile,
  type ProfilePatchRequest,
  type ProfileResponse,
} from "@/lib/profile-api";
import { queryKeys } from "./keys";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<ProfileResponse, Error, ProfilePatchRequest>({
    mutationFn: (patch) => patchProfile(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
}
