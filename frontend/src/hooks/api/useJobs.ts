import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/jobs-api";
import type { JobOption } from "@/lib/jobs-api";
import { queryKeys } from "./keys";

export function useJobs(filters: Record<string, unknown> = {}) {
  return useQuery<{ items: JobOption[]; total: number }>({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: () => listJobs(),
    staleTime: 1000 * 60 * 2,
  });
}
