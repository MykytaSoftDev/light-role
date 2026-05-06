"use client";

/**
 * TAILOR-10 — Inline plain-text field that adopts surrounding typography.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.4.
 *
 * Borderless input. No box, no padding. On focus, a 1px primary underline
 * appears. The font / size / color are inherited from the parent so the
 * editing experience reads as "edit in place" inside the document.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export interface InlineTextFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange"
  > {
  value: string;
  onChange: (value: string) => void;
  /** Optional inline error message; renders below in destructive color. */
  error?: string | null;
  /** Optional className override for the input element itself. */
  inputClassName?: string;
}

export const InlineTextField = React.forwardRef<
  HTMLInputElement,
  InlineTextFieldProps
>(function InlineTextField(
  {
    value,
    onChange,
    error,
    inputClassName,
    placeholder,
    className,
    ...rest
  },
  ref
) {
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // Adopt surrounding typography
          "bg-transparent outline-none border-0 p-0 m-0 font-inherit",
          // Use min-w-0 to let the input shrink in flex parents; let the
          // surrounding flex layout decide width.
          "min-w-0 w-full",
          // Underline: transparent by default, primary on focus (visual cue).
          "border-b border-transparent focus:border-primary",
          // Caret cursor on hover (spec §4.2)
          "hover:cursor-text",
          // Placeholder color
          "placeholder:text-muted-foreground/60",
          // Error state: red underline
          error && "border-destructive focus:border-destructive",
          inputClassName
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-destructive mt-0.5">{error}</span>
      ) : null}
    </span>
  );
});
