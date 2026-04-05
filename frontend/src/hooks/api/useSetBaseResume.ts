import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setBaseResume } from "@/lib/resume-api";
import type { ResumeResponse } from "@/types/resume";
import { queryKeys } from "./keys";

export function useSetBaseResume() {
  const queryClient = useQueryClient();

  return useMutation<ResumeResponse, Error, string>({
    mutationFn: setBaseResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}
