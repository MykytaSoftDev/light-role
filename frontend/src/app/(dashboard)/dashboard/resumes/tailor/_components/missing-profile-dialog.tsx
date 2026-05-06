"use client";

/**
 * TAILOR-6 — Missing Profile dialog (spec §1.7.A).
 *
 * Non-dismissible by overlay click. Esc/Cancel returns user to the wizard
 * with the gate still flagged (submit stays disabled in the parent).
 */
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
          <DialogTitle>Missing profile information</DialogTitle>
          <DialogDescription>
            Tailoring needs at least one piece of experience to draw from. Add
            at least one employment entry or one project to your profile.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/profile");
            }}
          >
            Complete profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
