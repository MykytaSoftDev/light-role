import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type FeedbackType = "bug" | "feature_request" | "improvement" | "other";

export interface CreateFeedbackInput {
  type: FeedbackType;
  message: string;
  page_url?: string;
}

export interface FeedbackResponse {
  id: string;
  type: FeedbackType;
  message: string;
  status: string;
  created_at: string;
}

export interface RateLimitError extends Error {
  status: 429;
  retryAfter: string | null;
}

async function createFeedback(data: CreateFeedbackInput): Promise<FeedbackResponse> {
  const res = await api.post("/api/v1/feedback", data);
  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      throw Object.assign(new Error("rate_limited"), { status: 429, retryAfter });
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export function useCreateFeedback() {
  return useMutation<FeedbackResponse, Error, CreateFeedbackInput>({
    mutationFn: createFeedback,
  });
}
