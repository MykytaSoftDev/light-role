"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Shared confirmation modal shell used by all four admin actions
// (Grant Pro, Cancel Subscription, Reset Billing Cycle, Reset AI Ops).
// Built on shadcn <Dialog> per the project rule against native browser
// dialogs (see memory: feedback_no_browser_dialogs).

export interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  iconClassName?: string;
  actionName: string;
  targetEmail: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  isPending: boolean;
  onConfirm: () => void;
  /** Disable the confirm button (e.g. inline validation failed). */
  disabled?: boolean;
  /** Error message to render below the warning box (mutation error). */
  errorMessage?: string | null;
  /** Action-specific body — e.g. the Grant Pro days input. */
  children?: React.ReactNode;
}

export function ConfirmActionModal({
  open,
  onOpenChange,
  icon: Icon,
  iconClassName,
  actionName,
  targetEmail,
  description,
  confirmLabel,
  confirmVariant = "default",
  isPending,
  onConfirm,
  disabled,
  errorMessage,
  children,
}: ConfirmActionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconClassName)} />
            {actionName}
          </DialogTitle>
          <DialogDescription>
            Performing <strong>{actionName}</strong> on{" "}
            <strong>{targetEmail}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Gray "what this does" info box */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="mb-1 font-medium">What this does</p>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {/* Optional action-specific body (e.g. Grant Pro days input) */}
        {children}

        {/* Red irreversible-action warning */}
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-destructive">This action cannot be undone.</p>
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isPending || disabled}
          >
            {isPending ? "Processing…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
