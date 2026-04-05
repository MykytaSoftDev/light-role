import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

async function deleteJob(id: string): Promise<void> {
  const res = await api.delete(`/api/v1/jobs/${id}`);
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete job: HTTP ${res.status}`);
  }
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
