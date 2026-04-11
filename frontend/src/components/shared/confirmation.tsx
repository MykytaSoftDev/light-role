import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ReactNode } from "react";

export interface Props {
  isOpen: boolean;
  title: ReactNode;
  description: ReactNode;
  onClose: (open: boolean) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function Confirmation({ isOpen, onClose, title, description, onConfirm, confirmLabel = "Confirm" }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={"flex flex-col gap-6"}>
          <DialogDescription>{description}</DialogDescription>
          <div className={"flex w-full items-center justify-end gap-4"}>
            <Button onClick={() => onClose(false)} variant={"outline"}>
              Close
            </Button>
            <Button onClick={() => onConfirm()} variant={"destructive"}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
