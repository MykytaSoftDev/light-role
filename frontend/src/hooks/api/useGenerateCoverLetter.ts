import { useMutation } from "@tanstack/react-query";
import { generateCoverLetter } from "@/lib/cover-letter-api";
import type { GenerateVariantsResponse, CLStyle, CLTone, CLLength } from "@/types/cover-letter";

interface GenerateCoverLetterPayload {
  job_id: string;
  resume_id: string;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  additional_context: string;
}

export function useGenerateCoverLetter() {
  return useMutation<GenerateVariantsResponse, Error, GenerateCoverLetterPayload>({
    mutationFn: generateCoverLetter,
  });
}
