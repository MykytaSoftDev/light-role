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

import { TiptapField } from "../fields/tiptap-field";
import { EditableSection } from "../editable-section";

interface SummaryEditorProps {
  value: string;
  onChange: (next: string) => void;
}

export const SummaryEditor = React.memo(function SummaryEditor({
  value,
  onChange,
}: SummaryEditorProps) {
  return (
    <EditableSection title="Summary">
      <TiptapField
        value={value}
        onChange={onChange}
        enableBulletList={false}
        placeholder="Add a short summary of your experience and goals."
        proseClassName="resume-summary"
        ariaLabel="Summary"
      />
    </EditableSection>
  );
});
