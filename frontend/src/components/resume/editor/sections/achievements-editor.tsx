"use client";

/**
 * TAILOR-10 — Achievements section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.9.
 *
 * Per entry:
 *   Row 1: title | date
 *   Row 2: issuer
 *   Row 3: description (Tiptap)
 */
import * as React from "react";
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

import type { AchievementEntry } from "@/lib/profile-api";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { EditableEntry } from "../editable-entry";
import { EditableSection } from "../editable-section";
import { InlineTextField } from "../fields/inline-text-field";
import { MonthInput } from "../fields/month-input";
import { TiptapField } from "../fields/tiptap-field";

interface AchievementsEditorProps {
  value: AchievementEntry[];
  onChange: (next: AchievementEntry[]) => void;
  focusEntryId?: string | null;
  onFocusApplied?: () => void;
  /** TAILOR-12 — keyword highlighting (forwarded to TiptapField). */
  keywords?: MatchedKeyword[];
}

export function AchievementsEditor({
  value,
  onChange,
  focusEntryId,
  onFocusApplied,
  keywords,
}: AchievementsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleAdd() {
    const newEntry: AchievementEntry = {
      id: crypto.randomUUID(),
      title: "",
      description: null,
      date: null,
      issuer: null,
    };
    onChange([...value, newEntry]);
  }

  function handleEntryChange(id: string, patch: Partial<AchievementEntry>) {
    onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function handleRemove(id: string) {
    onChange(value.filter((a) => a.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = value.map((a) => a.id ?? "");
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  }

  const ids = value.map((a) => a.id ?? "");

  return (
    <EditableSection
      title="Achievements"
      addLabel="Add achievement"
      onAdd={handleAdd}
      isEmpty={value.length === 0}
      emptyMessage="No achievements yet — click + to add."
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {value.map((entry) => (
            <AchievementEntryEditor
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

interface AchievementEntryEditorProps {
  entry: AchievementEntry;
  autoFocus: boolean;
  onAutoFocusApplied?: () => void;
  onChange: (patch: Partial<AchievementEntry>) => void;
  onRemove: () => void;
  keywords?: MatchedKeyword[];
}

const AchievementEntryEditor = React.memo(function AchievementEntryEditor({
  entry,
  autoFocus,
  onAutoFocusApplied,
  onChange,
  onRemove,
  keywords,
}: AchievementEntryEditorProps) {
  const titleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      titleRef.current?.focus();
      onAutoFocusApplied?.();
    }
  }, [autoFocus, onAutoFocusApplied]);

  return (
    <EditableEntry
      id={entry.id ?? "__missing"}
      label="Achievement entry"
      onRemove={onRemove}
    >
      <div className="resume-entry-row flex items-baseline justify-between gap-4">
        <div className="resume-entry-row-left flex-1 min-w-0">
          <span className="resume-entry-title">
            <InlineTextField
              ref={titleRef}
              value={entry.title}
              onChange={(title) => onChange({ title })}
              placeholder="Achievement title"
              aria-label="Title"
            />
          </span>
        </div>
        <div className="resume-entry-row-right">
          <span className="resume-entry-meta">
            <MonthInput
              value={entry.date ?? null}
              onChange={(d) => onChange({ date: d })}
              placeholder="Date"
              clearable
              ariaLabel="Date"
            />
          </span>
        </div>
      </div>

      <p className="resume-entry-subtitle">
        <InlineTextField
          value={entry.issuer ?? ""}
          onChange={(v) => onChange({ issuer: v || null })}
          placeholder="Issuer"
          aria-label="Issuer"
        />
      </p>

      <div className="resume-entry-body mt-1">
        <TiptapField
          value={entry.description ?? ""}
          onChange={(html) => onChange({ description: html })}
          enableBulletList={false}
          placeholder="Describe the achievement"
          ariaLabel="Description"
          keywords={keywords}
        />
      </div>
    </EditableEntry>
  );
});
