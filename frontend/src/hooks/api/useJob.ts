import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { JobOption } from "@/lib/jobs-api";
import { queryKeys } from "./keys";

async function getJob(id: string): Promise<JobOption> {
  const res = await api.get(`/api/v1/jobs/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch job: HTTP ${res.status}`);
  return res.json();
}

export function useJob(id: string) {
  return useQuery<JobOption>({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: () => getJob(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 3,
  });
}
