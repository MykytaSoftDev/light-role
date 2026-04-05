import { useQuery } from "@tanstack/react-query";
import { listResumes } from "@/lib/resume-api";
import type { ResumeListItem } from "@/types/resume";
import { queryKeys } from "./keys";

export function useResumes(filters?: Record<string, unknown>) {
  return useQuery<{ items: ResumeListItem[]; total: number }>({
    queryKey: queryKeys.resumes.list(filters),
    queryFn: () => listResumes(),
    staleTime: 1000 * 60 * 2,
  });
}
