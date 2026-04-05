import { useQuery } from "@tanstack/react-query";
import { listCoverLetters } from "@/lib/cover-letter-api";
import type { CoverLetterListItem } from "@/types/cover-letter";
import { queryKeys } from "./keys";

interface UseCoverLettersOptions {
  jobId?: string;
}

export function useCoverLetters({ jobId }: UseCoverLettersOptions = {}) {
  return useQuery<{ items: CoverLetterListItem[]; total: number }>({
    queryKey: queryKeys.coverLetters.list(jobId ? { jobId } : undefined),
    queryFn: () => listCoverLetters(jobId),
    staleTime: 1000 * 60 * 2,
  });
}
