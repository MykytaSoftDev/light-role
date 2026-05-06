"use client";

/**
 * TAILOR-9 — Edit button (Preview mode).
 *
 * Sits in the slot reserved by `<PreviewFrame>` at the top edge of the resume
 * frame. Clicking it enters Edit mode (snapshot taken, toolbar replaces this
 * button).
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §2.
 */
import * as React from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EditButtonProps {
  onClick: () => void;
}

export const EditButton = React.forwardRef<HTMLButtonElement, EditButtonProps>(
  function EditButton({ onClick }, ref) {
    return (
      <Button
        ref={ref}
        type="button"
        size="sm"
        onClick={onClick}
        // Lives inside the PreviewFrame's top-bar slot — left-aligned via
        // the parent's flex container. No absolute positioning needed.
        className="h-8 transition-opacity duration-200"
        aria-label="Enter edit mode"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    );
  }
);
