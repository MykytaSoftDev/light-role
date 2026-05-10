"use client";

/**
 * TAILOR-6 — Missing Profile dialog (spec §1.7.A).
 *
 * Non-dismissible by overlay click. Esc/Cancel returns user to the wizard
 * with the gate still flagged (submit stays disabled in the parent).
 */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

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

export function MissingProfileDialog({
  open,
  onClose,
}: MissingProfileDialogProps) {
  const t = useTranslations("Resumes.tailor.missingProfile");
  const router = useRouter();

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
            {t("cancel")}
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
