"use client";

/**
 * TAILOR-10 — Volunteer section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.10.
 *
 * Identical to Employment with field renames: `company` → `organization`.
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

import { Switch } from "@/components/ui/switch";
import type { VolunteerEntry } from "@/lib/profile-api";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { EditableEntry } from "../editable-entry";
import { EditableSection } from "../editable-section";
import { InlineTextField } from "../fields/inline-text-field";
import { MonthInput } from "../fields/month-input";
import {
  TiptapField,
  bulletListFromStrings,
  htmlToBulletList,
} from "../fields/tiptap-field";

interface VolunteerEditorProps {
  value: VolunteerEntry[];
  onChange: (next: VolunteerEntry[]) => void;
  focusEntryId?: string | null;
  onFocusApplied?: () => void;
  /** TAILOR-12 — keyword highlighting (forwarded to TiptapField). */
  keywords?: MatchedKeyword[];
}

export function VolunteerEditor({
  value,
  onChange,
  focusEntryId,
  onFocusApplied,
  keywords,
}: VolunteerEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleAdd() {
    const newEntry: VolunteerEntry = {
      id: crypto.randomUUID(),
      role: "",
      organization: "",
      location: null,
      start_date: "",
      end_date: null,
      is_current: false,
      details: [],
    };
    onChange([...value, newEntry]);
  }

  function handleEntryChange(id: string, patch: Partial<VolunteerEntry>) {
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
      title="Volunteer"
      addLabel="Add volunteer experience"
      onAdd={handleAdd}
      isEmpty={value.length === 0}
      emptyMessage="No volunteer experience yet — click + to add."
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {value.map((entry) => (
            <VolunteerEntryEditor
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

interface VolunteerEntryEditorProps {
  entry: VolunteerEntry;
  autoFocus: boolean;
  onAutoFocusApplied?: () => void;
  onChange: (patch: Partial<VolunteerEntry>) => void;
  onRemove: () => void;
  keywords?: MatchedKeyword[];
}

const VolunteerEntryEditor = React.memo(function VolunteerEntryEditor({
  entry,
  autoFocus,
  onAutoFocusApplied,
  onChange,
  onRemove,
  keywords,
}: VolunteerEntryEditorProps) {
  const roleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      roleRef.current?.focus();
      onAutoFocusApplied?.();
    }
  }, [autoFocus, onAutoFocusApplied]);

  const initialBullets = React.useMemo(
    () => bulletListFromStrings(entry.details ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id]
  );

  return (
    <EditableEntry
      id={entry.id ?? "__missing"}
      label="Volunteer entry"
      onRemove={onRemove}
    >
      <div className="resume-entry-row flex items-baseline justify-between gap-4">
        <div className="resume-entry-row-left flex-1 min-w-0">
          <span className="resume-entry-title">
            <InlineTextField
              ref={roleRef}
              value={entry.role}
              onChange={(role) => onChange({ role })}
              placeholder="Role"
              aria-label="Role"
            />
          </span>
        </div>
        <div className="resume-entry-row-right flex items-center gap-1">
          <span className="resume-entry-meta inline-flex items-center gap-1">
            <MonthInput
              value={entry.start_date || null}
              onChange={(d) => onChange({ start_date: d ?? "" })}
              placeholder="Start"
              ariaLabel="Start date"
            />
            <span className="text-muted-foreground/70">–</span>
            {entry.is_current ? (
              <span className="px-1 text-sm">Present</span>
            ) : (
              <MonthInput
                value={entry.end_date ?? null}
                onChange={(d) => onChange({ end_date: d })}
                placeholder="End"
                clearable
                ariaLabel="End date"
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
          aria-label="I currently volunteer here"
        />
        <span>I currently volunteer here</span>
      </label>

      <p className="resume-entry-subtitle flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <InlineTextField
          value={entry.organization}
          onChange={(organization) => onChange({ organization })}
          placeholder="Organization"
          aria-label="Organization"
          inputClassName="font-medium"
        />
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <InlineTextField
          value={entry.location ?? ""}
          onChange={(location) => onChange({ location: location || null })}
          placeholder="Location"
          aria-label="Location"
        />
      </p>

      <div className="resume-entry-body mt-1">
        <TiptapField
          value={initialBullets}
          onChange={(html) => onChange({ details: htmlToBulletList(html) })}
          enableBulletList
          placeholder="• Add a bullet describing what you did"
          ariaLabel="Bullets"
          keywords={keywords}
        />
      </div>
    </EditableEntry>
  );
});
