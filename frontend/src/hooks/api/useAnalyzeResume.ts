import { useMutation } from "@tanstack/react-query";
import { analyzeResume } from "@/lib/resume-api";

interface AnalyzeResumePayload {
  resumeId: string;
  jobId: string;
}

export function useAnalyzeResume() {
  return useMutation<{ task_id: string; resume_id: string }, Error, AnalyzeResumePayload>({
    mutationFn: ({ resumeId, jobId }) => analyzeResume(resumeId, jobId),
  });
}
