"use client";

/**
 * TAILOR-10 — Skills section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.5.
 *
 * Single ChipInputField over `skills[]`. Each `SkillEntry` has `{id, name}`
 * (the schema's optional `category`/`level` fields are reserved for future
 * use and not editable here).
 */
import * as React from "react";
import { useTranslations } from "next-intl";

import type { SkillEntry } from "@/lib/profile-api";

import { ChipInputField } from "../fields/chip-input-field";
import { EditableSection } from "../editable-section";

interface SkillsEditorProps {
  value: SkillEntry[];
  onChange: (next: SkillEntry[]) => void;
}

export const SkillsEditor = React.memo(function SkillsEditor({
  value,
  onChange,
}: SkillsEditorProps) {
  const tSection = useTranslations("Resumes.sectionTitles");
  const tProfile = useTranslations("profile.skills");
  const tEditor = useTranslations("Resumes.editor.section");
  // Map the chip input's stable-id model onto SkillEntry. We require an id on
  // every entry — stamp UUIDs defensively so a malformed input doesn't break
  // dnd reorder.
  const chips = React.useMemo(
    () =>
      value.map((s) => ({
        id: s.id ?? crypto.randomUUID(),
        label: s.name,
      })),
    [value]
  );

  function handleAdd(label: string) {
    onChange([...value, { id: crypto.randomUUID(), name: label }]);
  }

  function handleRemove(id: string) {
    onChange(value.filter((s) => s.id !== id));
  }

  function handleReorder(nextIds: string[]) {
    const byId = new Map(value.map((s) => [s.id, s]));
    onChange(nextIds.map((id) => byId.get(id)).filter(Boolean) as SkillEntry[]);
  }

  return (
    <EditableSection title={tSection("skills")}>
      <ChipInputField
        values={chips}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onReorder={handleReorder}
        placeholder={tEditor("addSkillPlaceholder")}
        ariaLabel={tProfile("addSkill")}
      />
    </EditableSection>
  );
});
