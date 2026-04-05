import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadResume } from "@/lib/resume-api";
import type { ResumeResponse } from "@/types/resume";
import { queryKeys } from "./keys";

interface UploadResumePayload {
  file: File;
  jobId?: string;
}

export function useUploadResume() {
  const queryClient = useQueryClient();

  return useMutation<ResumeResponse, Error, UploadResumePayload>({
    mutationFn: ({ file, jobId }) => uploadResume(file, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}
