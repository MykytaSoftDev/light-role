"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface UpgradeTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeTemplateModal({ open, onClose }: UpgradeTemplateModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">Unlock premium templates</DialogTitle>
          <DialogDescription className="text-center">
            Modern and Minimal templates are available on the Pro plan.
            Get a polished, professional resume that stands out.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <a href="/dashboard/settings?tab=billing">Upgrade to Pro</a>
          </Button>
          <DialogClose asChild>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Maybe later
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
