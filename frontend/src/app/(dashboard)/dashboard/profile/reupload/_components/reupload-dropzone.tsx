"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2, UploadCloud } from "lucide-react";
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
    <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
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
          "group relative flex flex-col items-center justify-center gap-5 overflow-hidden rounded-lg border-2 border-dashed border-border bg-gradient-to-b from-muted/30 to-background px-6 py-16 text-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isLoading
            ? "cursor-not-allowed opacity-95"
            : "cursor-pointer hover:border-primary/50 hover:from-primary/5 hover:to-background",
          dragOver &&
            !isLoading &&
            "scale-[1.01] border-primary bg-primary/5 ring-4 ring-primary/20",
          inlineError &&
            !dragOver &&
            !isLoading &&
            "border-destructive/60 from-destructive/5",
        )}
      >
        {/* Subtle decorative dot pattern */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 opacity-[0.04] transition-opacity",
            "[background-image:radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] [background-size:20px_20px]",
            dragOver && !isLoading && "opacity-[0.08]",
          )}
        />

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
            <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">
                {t("parsing")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("parsingHint")}
              </p>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "relative flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-200",
                "group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary",
                dragOver && "scale-110 bg-primary/15 text-primary",
              )}
            >
              <UploadCloud
                className={cn(
                  "size-7 transition-transform",
                  dragOver && "animate-pulse",
                )}
              />
              {dragOver && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-base font-semibold text-foreground sm:text-lg">
                {t("dropPrompt")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("clickFallback")}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <FileText className="size-3.5" aria-hidden="true" />
              {t("supportedFormats")}
            </div>
          </>
        )}

        {inlineError && !isLoading && (
          <p
            role="alert"
            className="relative mt-1 text-sm font-medium text-destructive"
          >
            {inlineError}
          </p>
        )}
      </div>
    </Card>
  );
}
