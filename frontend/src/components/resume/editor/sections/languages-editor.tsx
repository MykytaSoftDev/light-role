"use client";

/**
 * TAILOR-10 — Languages section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.6.
 *
 * INVERSION CALLOUT: in Preview the document renders languages as a flat
 * bullet list (per classic-template-spec §5.5), but in EDIT MODE we render
 * them as chips for input simplicity. The schema (`{id, name}`) is identical
 * either way — only the rendering surface differs.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import type { LanguageEntry } from "@/lib/profile-api";

import { ChipInputField } from "../fields/chip-input-field";
import { EditableSection } from "../editable-section";

interface LanguagesEditorProps {
  value: LanguageEntry[];
  onChange: (next: LanguageEntry[]) => void;
}

export const LanguagesEditor = React.memo(function LanguagesEditor({
  value,
  onChange,
}: LanguagesEditorProps) {
  const tSection = useTranslations("Resumes.sectionTitles");
  const tProfile = useTranslations("profile.languages");
  const tEditor = useTranslations("Resumes.editor.section");
  const chips = React.useMemo(
    () =>
      value.map((l) => ({
        id: l.id ?? crypto.randomUUID(),
        label: l.name,
      })),
    [value]
  );

  function handleAdd(label: string) {
    onChange([...value, { id: crypto.randomUUID(), name: label }]);
  }

  function handleRemove(id: string) {
    onChange(value.filter((l) => l.id !== id));
  }

  function handleReorder(nextIds: string[]) {
    const byId = new Map(value.map((l) => [l.id, l]));
    onChange(
      nextIds.map((id) => byId.get(id)).filter(Boolean) as LanguageEntry[]
    );
  }

  return (
    <EditableSection title={tSection("languages")}>
      <ChipInputField
        values={chips}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onReorder={handleReorder}
        placeholder={tEditor("addLanguagePlaceholder")}
        ariaLabel={tProfile("addLanguage")}
      />
    </EditableSection>
  );
});
