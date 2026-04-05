import { useMutation } from "@tanstack/react-query";
import { exportCoverLetter } from "@/lib/cover-letter-api";

interface ExportCoverLetterPayload {
  id: string;
  format: "pdf" | "docx";
}

export function useExportCoverLetter() {
  return useMutation<void, Error, ExportCoverLetterPayload>({
    mutationFn: ({ id, format }) => exportCoverLetter(id, format),
  });
}
