"use client";

/**
 * TAILOR-9 — Discard unsaved changes dialog.
 *
 * Used by the Cancel button when the draft is dirty AND by the navigation
 * guard (sidebar links / browser back) when the user attempts to leave Edit
 * mode with unsaved changes.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §1.7.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DiscardChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: DiscardChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            You have unsaved edits to this resume. Leaving now will lose them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Stay
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Discard &amp; leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
