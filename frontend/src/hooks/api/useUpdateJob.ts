import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { JobOption } from "@/lib/jobs-api";
import { queryKeys } from "./keys";

interface UpdateJobPayload {
  id: string;
  data: Partial<Omit<JobOption, "id">>;
}

async function updateJob({ id, data }: UpdateJobPayload): Promise<JobOption> {
  const res = await api.patch(`/api/v1/jobs/${id}`, data);
  if (!res.ok) throw new Error(`Failed to update job: HTTP ${res.status}`);
  return res.json();
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation<JobOption, Error, UpdateJobPayload>({
    mutationFn: updateJob,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobs.detail(variables.id),
      });
    },
  });
}
