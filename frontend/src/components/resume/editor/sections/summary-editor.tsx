"use client";

/**
 * TAILOR-10 — Summary section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.2.
 *
 * Single Tiptap instance over `summary: string`. The output is HTML; the
 * surrounding ClassicTemplate's `.resume-summary` CSS handles the type scale
 * and paragraph spacing.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { TiptapField } from "../fields/tiptap-field";
import { EditableSection } from "../editable-section";

interface SummaryEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** TAILOR-12 — keyword highlighting (forwarded to TiptapField). */
  keywords?: MatchedKeyword[];
}

export const SummaryEditor = React.memo(function SummaryEditor({
  value,
  onChange,
  keywords,
}: SummaryEditorProps) {
  const tSection = useTranslations("Resumes.sectionTitles");
  const tProfile = useTranslations("profile.profileSummary");
  const tEditor = useTranslations("Resumes.editor.section");
  return (
    <EditableSection title={tSection("summary")}>
      <TiptapField
        value={value}
        onChange={onChange}
        enableBulletList={false}
        placeholder={tEditor("summaryPlaceholder")}
        proseClassName="resume-summary"
        ariaLabel={tProfile("label")}
        keywords={keywords}
      />
    </EditableSection>
  );
});
