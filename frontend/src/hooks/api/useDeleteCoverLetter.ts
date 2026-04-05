import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCoverLetter } from "@/lib/cover-letter-api";
import { queryKeys } from "./keys";

export function useDeleteCoverLetter() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteCoverLetter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coverLetters.all });
    },
  });
}
