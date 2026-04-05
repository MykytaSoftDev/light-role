import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface BillingPortalResponse {
  url: string;
}

async function openBillingPortal(): Promise<BillingPortalResponse> {
  const res = await api.post("/api/v1/subscriptions/portal-session");
  if (!res.ok) throw new Error(`Failed to open billing portal: HTTP ${res.status}`);
  return res.json();
}

export function useOpenBillingPortal() {
  return useMutation<BillingPortalResponse, Error, void>({
    mutationFn: openBillingPortal,
  });
}
