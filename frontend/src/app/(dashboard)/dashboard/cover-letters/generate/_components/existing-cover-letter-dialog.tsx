"use client";

/**
 * Cover-letter wizard — "Cover Letter Already Exists" dialog (spec §2.7.B).
 *
 * Surfaces when:
 *   1. The pre-filled `?job_id` already has a CL (mount-time conflict), or
 *   2. The Generate API returns 409 mid-flow (race condition).
 *
 * The dialog provides a direct deep-link to the existing CL's editor.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExistingClInfo {
  coverLetterId: string;
  jobTitle: string;
  company: string | null;
  createdAt: string;
}

interface ExistingCoverLetterDialogProps {
  open: boolean;
  info: ExistingClInfo | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ExistingCoverLetterDialog({
  open,
  info,
  onClose,
}: ExistingCoverLetterDialogProps) {
  const router = useRouter();
  const t = useTranslations("coverLetters.wizard.step1.modal.alreadyExists");
  const tCommon = useTranslations("coverLetters.wizard.common");

  const heading = info
    ? info.company
      ? `${info.company} — ${info.jobTitle}`
      : info.jobTitle
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        {info && (
          <div className="flex items-center gap-3 rounded-md bg-muted p-3">
            <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{heading}</p>
              <p className="text-xs text-muted-foreground">
                {t("createdAt", { date: formatDate(info.createdAt) })}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          {info && (
            <Button asChild type="button">
              <Link
                href={`/dashboard/cover-letters/${info.coverLetterId}`}
                onClick={() => {
                  onClose();
                  router.replace(`/dashboard/cover-letters/${info.coverLetterId}`);
                }}
              >
                {t("viewCta")}
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
