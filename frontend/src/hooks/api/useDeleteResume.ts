import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteResume } from "@/lib/resume-api";
import { queryKeys } from "./keys";

export function useDeleteResume() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}
