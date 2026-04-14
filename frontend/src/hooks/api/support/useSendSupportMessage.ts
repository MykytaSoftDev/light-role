import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type SupportCategory = "account" | "billing" | "technical" | "other";

export interface SendSupportInput {
  subject: string;
  message: string;
  category: SupportCategory;
}

export interface SendSupportResponse {
  success: true;
  message: string;
}

async function sendSupportMessage(data: SendSupportInput): Promise<SendSupportResponse> {
  const res = await api.post("/api/v1/support/contact", data);
  if (!res.ok) {
    if (res.status === 429) {
      throw Object.assign(new Error("rate_limited"), { status: 429 });
    }
    if (res.status === 503) {
      throw Object.assign(new Error("service_unavailable"), { status: 503 });
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export function useSendSupportMessage() {
  return useMutation<SendSupportResponse, Error, SendSupportInput>({
    mutationFn: sendSupportMessage,
  });
}
