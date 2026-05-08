"use client";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this cover letter?</DialogTitle>
          <DialogDescription>
            &ldquo;{coverLetterName}&rdquo; will be permanently deleted. The
            linked Job stays untouched, and you can generate a new cover
            letter for it any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
