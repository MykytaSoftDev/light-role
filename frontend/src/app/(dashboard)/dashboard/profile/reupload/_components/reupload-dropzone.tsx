"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useResetProfile } from "@/hooks/api/useResetProfile";

const ALLOWED_EXTENSIONS = [".pdf", ".docx"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

interface ReuploadDropzoneProps {
  /**
   * i18n key for the success toast. Defaults to the existing reupload page
   * message ("profile.reupload.successToast"). The empty-state picker
   * overrides this with "profile.emptyState.successToast".
   */
  successToastKey?: string;
  /**
   * Callback fired after the AI parse succeeds. Defaults to redirecting to
   * the Personal Info tab — appropriate for the standalone reupload page.
   * The empty-state picker passes a no-op so the empty state evaporates
   * automatically once the React Query cache refresh flips `isProfileEmpty`.
   */
  onSuccess?: () => void;
}

export function ReuploadDropzone({
  successToastKey = "profile.reupload.successToast",
  onSuccess,
}: ReuploadDropzoneProps = {}) {
  const t = useTranslations("profile.reupload");
  // Resolve the success toast at the root so any `profile.*` key works.
  const tRoot = useTranslations();
  const router = useRouter();
  const reset = useResetProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const isLoading = reset.isPending;

  function validateFile(file: File): string | null {
    const lowered = file.name.toLowerCase();
    const okExt = ALLOWED_EXTENSIONS.some((ext) => lowered.endsWith(ext));
    if (!okExt) return t("invalidFormat");
    if (file.size > MAX_BYTES) return t("fileTooLarge");
    return null;
  }

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setInlineError(err);
      return;
    }
    setInlineError(null);
    reset.mutate(file, {
      onSuccess: () => {
        toast.success(tRoot(successToastKey));
        if (onSuccess) {
          onSuccess();
        } else {
          router.replace("/dashboard/profile?tab=personal-info");
        }
      },
      onError: () => {
        toast.error(t("errorToast"));
      },
    });
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    if (isLoading) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (isLoading) return;
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (isLoading) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleClick() {
    if (isLoading) return;
    inputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (isLoading) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after a failure.
    e.target.value = "";
    if (file) handleFile(file);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div
        role="button"
        tabIndex={isLoading ? -1 : 0}
        aria-disabled={isLoading}
        aria-label={t("dropPrompt")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-background px-6 py-16 text-center transition-colors",
          isLoading
            ? "cursor-not-allowed opacity-90"
            : "cursor-pointer hover:border-primary/60 hover:bg-muted/40",
          dragOver && !isLoading && "border-primary bg-primary/5 ring-2 ring-primary/30",
          inlineError && !dragOver && !isLoading && "border-destructive/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{t("parsing")}</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-base font-medium">{t("dropPrompt")}</p>
              <p className="text-sm text-muted-foreground">{t("clickFallback")}</p>
            </div>
          </>
        )}

        {inlineError && !isLoading && (
          <p
            role="alert"
            className="mt-2 text-sm font-medium text-destructive"
          >
            {inlineError}
          </p>
        )}
      </div>
    </Card>
  );
}
