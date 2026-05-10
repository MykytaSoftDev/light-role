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

interface DeleteCoverLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverLetterName: string;
  onConfirm: () => void;
}

/**
 * Delete confirmation dialog for a cover letter (CL-10).
 *
 * Mirrors `DeleteResumeDialog` — the actual mutation lives at the page
 * level so React Query can do an optimistic remove + rollback. This
 * component only collects the user's confirmation and closes itself.
 */
export function DeleteCoverLetterDialog({
  open,
  onOpenChange,
  coverLetterName,
  onConfirm,
}: DeleteCoverLetterDialogProps) {
  const t = useTranslations("coverLetters.list.delete");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("body", { name: coverLetterName })}
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
