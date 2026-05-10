"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeName: string;
  /** Whether this resume has a star rating — affects the dialog body copy. */
  hasRating: boolean;
  onConfirm: () => void;
}

/**
 * Delete confirmation dialog for a tailored resume (TAILOR-15 §4).
 *
 * The actual mutation lives at the page level so React Query can do an
 * optimistic remove + rollback. This component only collects the user's
 * confirmation and closes itself.
 */
export function DeleteResumeDialog({
  open,
  onOpenChange,
  resumeName,
  hasRating,
  onConfirm,
}: DeleteResumeDialogProps) {
  const t = useTranslations("Resumes.list.delete");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("body", { name: resumeName })}
            {hasRating ? t("bodyHasRating") : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
