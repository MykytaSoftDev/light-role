"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";

export interface Props {
  isOpen: boolean;
  title: ReactNode;
  description: ReactNode;
  onClose: (open: boolean) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function Confirmation({ isOpen, onClose, title, description, onConfirm, confirmLabel }: Props) {
  const t = useTranslations("Common.actions");
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
              {t("close")}
            </Button>
            <Button onClick={() => onConfirm()} variant={"destructive"}>
              {confirmLabel ?? t("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
