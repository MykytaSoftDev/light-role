import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { JobOption } from "@/lib/jobs-api";
import { queryKeys } from "./keys";

interface CreateJobPayload {
  title: string;
  company?: string | null;
  status?: string;
  [key: string]: unknown;
}

async function createJob(data: CreateJobPayload): Promise<JobOption> {
  const res = await api.post("/api/v1/jobs", data);
  if (!res.ok) throw new Error(`Failed to create job: HTTP ${res.status}`);
  return res.json();
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation<JobOption, Error, CreateJobPayload>({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
