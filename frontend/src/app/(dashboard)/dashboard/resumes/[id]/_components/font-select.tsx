"use client";

/**
 * TAILOR-11 — Font selector dropdown.
 *
 * shadcn `Select` listing the 5 supported resume fonts. Each option's label
 * (and the trigger label of the currently-selected font) is rendered in its
 * own font for visual preview.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §3.3.1 / §6.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RESUME_FONTS,
  getResumeFontFamily,
  type ResumeFont,
} from "@/lib/fonts/resume-fonts";

interface FontSelectProps {
  value: string;
  onChange: (font: string) => void;
  disabled?: boolean;
}

export function FontSelect({ value, onChange, disabled }: FontSelectProps) {
  const t = useTranslations("Resumes.editor");
  // Normalize incoming value — if a previously-saved resume has an unknown
  // font string, fall back to Inter to keep the trigger readable.
  const normalized: ResumeFont = (RESUME_FONTS as readonly string[]).includes(value)
    ? (value as ResumeFont)
    : "Inter";

  return (
    <Select value={normalized} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={t("fontLabel")}
        className="h-8 w-[160px] text-sm"
      >
        <SelectValue>
          <span style={{ fontFamily: getResumeFontFamily(normalized) }}>
            {normalized}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RESUME_FONTS.map((font) => (
          <SelectItem key={font} value={font}>
            <span style={{ fontFamily: getResumeFontFamily(font) }}>
              {font}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
