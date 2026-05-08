"use client";

/**
 * Cover-letter wizard — Profile-not-ready dialog (spec §2.7.A).
 *
 * Non-dismissible by overlay click (Esc still closes). Cancelling keeps the
 * user on Step 1 with the gate still flagged — but `Next` is naturally
 * disabled because `jobId === ""` and no profile-readiness signal is shown
 * inline. The dialog re-opens automatically on every profile-readiness
 * recompute, so the user has to fix the profile to proceed.
 */
import { useRouter } from "next/navigation";
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

interface MissingProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MissingProfileDialog({ open, onClose }: MissingProfileDialogProps) {
  const router = useRouter();
  const t = useTranslations("coverLetters.wizard.step1.modal.missingProfile");
  const tCommon = useTranslations("coverLetters.wizard.common");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/profile");
            }}
          >
            {t("completeCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
