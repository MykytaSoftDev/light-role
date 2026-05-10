"use client";

/**
 * TAILOR-10 — Education section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.4.
 *
 * Per entry:
 *   Row 1: degree | start_date – end_date / "Present" | is_current
 *   Row 2: institution · field_of_study · location
 *   Row 3: description (Tiptap, bold/italic + bullet list)
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Switch } from "@/components/ui/switch";
import type { EducationEntry } from "@/lib/profile-api";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { EditableEntry } from "../editable-entry";
import { EditableSection } from "../editable-section";
import { InlineTextField } from "../fields/inline-text-field";
import { MonthInput } from "../fields/month-input";
import { TiptapField } from "../fields/tiptap-field";

interface EducationEditorProps {
  value: EducationEntry[];
  onChange: (next: EducationEntry[]) => void;
  focusEntryId?: string | null;
  onFocusApplied?: () => void;
  /** TAILOR-12 — keyword highlighting (forwarded to TiptapField). */
  keywords?: MatchedKeyword[];
}

export function EducationEditor({
  value,
  onChange,
  focusEntryId,
  onFocusApplied,
  keywords,
}: EducationEditorProps) {
  const tSection = useTranslations("Resumes.sectionTitles");
  const tProfile = useTranslations("profile.education");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleAdd() {
    const newEntry: EducationEntry = {
      id: crypto.randomUUID(),
      degree: "",
      institution: "",
      field_of_study: null,
      location: null,
      start_date: "",
      end_date: null,
      is_current: false,
      description: null,
    };
    onChange([...value, newEntry]);
  }

  function handleEntryChange(id: string, patch: Partial<EducationEntry>) {
    onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function handleRemove(id: string) {
    onChange(value.filter((e) => e.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = value.map((e) => e.id ?? "");
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  }

  const ids = value.map((e) => e.id ?? "");

  return (
    <EditableSection
      title={tSection("education")}
      addLabel={tProfile("addButton")}
      onAdd={handleAdd}
      isEmpty={value.length === 0}
      emptyMessage={tProfile("empty")}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {value.map((entry) => (
            <EducationEntryEditor
              key={entry.id ?? "__missing"}
              entry={entry}
              autoFocus={focusEntryId === entry.id}
              onAutoFocusApplied={onFocusApplied}
              onChange={(p) => handleEntryChange(entry.id ?? "", p)}
              onRemove={() => handleRemove(entry.id ?? "")}
              keywords={keywords}
            />
          ))}
        </SortableContext>
      </DndContext>
    </EditableSection>
  );
}

interface EducationEntryEditorProps {
  entry: EducationEntry;
  autoFocus: boolean;
  onAutoFocusApplied?: () => void;
  onChange: (patch: Partial<EducationEntry>) => void;
  onRemove: () => void;
  keywords?: MatchedKeyword[];
}

const EducationEntryEditor = React.memo(function EducationEntryEditor({
  entry,
  autoFocus,
  onAutoFocusApplied,
  onChange,
  onRemove,
  keywords,
}: EducationEntryEditorProps) {
  const tProfile = useTranslations("profile.education");
  const tEditor = useTranslations("Resumes.editor.section");
  const degreeRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      degreeRef.current?.focus();
      onAutoFocusApplied?.();
    }
  }, [autoFocus, onAutoFocusApplied]);

  return (
    <EditableEntry
      id={entry.id ?? "__missing"}
      label={tEditor("educationEntryLabel")}
      onRemove={onRemove}
    >
      <div className="resume-entry-row flex items-baseline justify-between gap-4">
        <div className="resume-entry-row-left flex-1 min-w-0">
          <span className="resume-entry-title">
            <InlineTextField
              ref={degreeRef}
              value={entry.degree}
              onChange={(degree) => onChange({ degree })}
              placeholder={tProfile("degree")}
              aria-label={tProfile("degree")}
            />
          </span>
        </div>
        <div className="resume-entry-row-right flex items-center gap-1">
          <span className="resume-entry-meta inline-flex items-center gap-1">
            <MonthInput
              value={entry.start_date || null}
              onChange={(d) => onChange({ start_date: d ?? "" })}
              placeholder={tEditor("startShort")}
              ariaLabel={tProfile("startDate")}
            />
            <span className="text-muted-foreground/70">–</span>
            {entry.is_current ? (
              <span className="px-1 text-sm">{tProfile("present")}</span>
            ) : (
              <MonthInput
                value={entry.end_date ?? null}
                onChange={(d) => onChange({ end_date: d })}
                placeholder={tEditor("endShort")}
                clearable
                ariaLabel={tProfile("endDate")}
              />
            )}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2 mt-1 text-xs text-muted-foreground select-none">
        <Switch
          checked={!!entry.is_current}
          onCheckedChange={(checked) =>
            onChange({
              is_current: checked,
              end_date: checked ? null : entry.end_date,
            })
          }
          aria-label={tProfile("isCurrent")}
        />
        <span>{tProfile("isCurrent")}</span>
      </label>

      <p className="resume-entry-subtitle flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <InlineTextField
          value={entry.institution}
          onChange={(institution) => onChange({ institution })}
          placeholder={tProfile("institution")}
          aria-label={tProfile("institution")}
          inputClassName="font-medium"
        />
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <InlineTextField
          value={entry.field_of_study ?? ""}
          onChange={(v) => onChange({ field_of_study: v || null })}
          placeholder={tProfile("fieldOfStudy")}
          aria-label={tProfile("fieldOfStudy")}
          inputClassName="italic"
        />
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <InlineTextField
          value={entry.location ?? ""}
          onChange={(v) => onChange({ location: v || null })}
          placeholder={tProfile("location")}
          aria-label={tProfile("location")}
        />
      </p>

      <div className="resume-entry-body mt-1">
        <TiptapField
          value={entry.description ?? ""}
          onChange={(html) => onChange({ description: html })}
          enableBulletList
          placeholder={tEditor("educationDetailsPlaceholder")}
          ariaLabel={tProfile("description")}
          keywords={keywords}
        />
      </div>
    </EditableEntry>
  );
});
