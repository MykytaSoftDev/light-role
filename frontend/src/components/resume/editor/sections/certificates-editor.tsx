"use client";

/**
 * TAILOR-10 — Certificates section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.7.
 *
 * Per entry plain inputs only — NO Tiptap.
 *   Row 1: name | issue_date
 *   Row 2: issuer | expiry_date (clearable)
 *   Row 3: credential_url (full row)
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

import type { CertificateEntry } from "@/lib/profile-api";

import { EditableEntry } from "../editable-entry";
import { EditableSection } from "../editable-section";
import { InlineTextField } from "../fields/inline-text-field";
import { MonthInput } from "../fields/month-input";

interface CertificatesEditorProps {
  value: CertificateEntry[];
  onChange: (next: CertificateEntry[]) => void;
  focusEntryId?: string | null;
  onFocusApplied?: () => void;
}

export function CertificatesEditor({
  value,
  onChange,
  focusEntryId,
  onFocusApplied,
}: CertificatesEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleAdd() {
    const newEntry: CertificateEntry = {
      id: crypto.randomUUID(),
      name: "",
      issuer: null,
      issue_date: null,
      expiry_date: null,
      credential_url: null,
    };
    onChange([...value, newEntry]);
  }

  function handleEntryChange(id: string, patch: Partial<CertificateEntry>) {
    onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function handleRemove(id: string) {
    onChange(value.filter((c) => c.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = value.map((c) => c.id ?? "");
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  }

  const ids = value.map((c) => c.id ?? "");

  return (
    <EditableSection
      title="Certificates"
      addLabel="Add certificate"
      onAdd={handleAdd}
      isEmpty={value.length === 0}
      emptyMessage="No certificates yet — click + to add."
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {value.map((entry) => (
            <CertificateEntryEditor
              key={entry.id ?? "__missing"}
              entry={entry}
              autoFocus={focusEntryId === entry.id}
              onAutoFocusApplied={onFocusApplied}
              onChange={(p) => handleEntryChange(entry.id ?? "", p)}
              onRemove={() => handleRemove(entry.id ?? "")}
            />
          ))}
        </SortableContext>
      </DndContext>
    </EditableSection>
  );
}

interface CertificateEntryEditorProps {
  entry: CertificateEntry;
  autoFocus: boolean;
  onAutoFocusApplied?: () => void;
  onChange: (patch: Partial<CertificateEntry>) => void;
  onRemove: () => void;
}

const CertificateEntryEditor = React.memo(function CertificateEntryEditor({
  entry,
  autoFocus,
  onAutoFocusApplied,
  onChange,
  onRemove,
}: CertificateEntryEditorProps) {
  const nameRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      nameRef.current?.focus();
      onAutoFocusApplied?.();
    }
  }, [autoFocus, onAutoFocusApplied]);

  return (
    <EditableEntry
      id={entry.id ?? "__missing"}
      label="Certificate entry"
      onRemove={onRemove}
    >
      <div className="resume-entry-row flex items-baseline justify-between gap-4">
        <div className="resume-entry-row-left flex-1 min-w-0">
          <span className="resume-entry-title">
            <InlineTextField
              ref={nameRef}
              value={entry.name}
              onChange={(name) => onChange({ name })}
              placeholder="Certificate name"
              aria-label="Certificate name"
            />
          </span>
        </div>
        <div className="resume-entry-row-right">
          <span className="resume-entry-meta">
            <MonthInput
              value={entry.issue_date ?? null}
              onChange={(d) => onChange({ issue_date: d })}
              placeholder="Issued"
              clearable
              ariaLabel="Issue date"
            />
          </span>
        </div>
      </div>

      <p className="resume-entry-subtitle flex flex-wrap items-baseline justify-between gap-x-2">
        <InlineTextField
          value={entry.issuer ?? ""}
          onChange={(v) => onChange({ issuer: v || null })}
          placeholder="Issuer"
          aria-label="Issuer"
          inputClassName="font-medium"
        />
        <span className="resume-entry-meta inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span>Expires:</span>
          <MonthInput
            value={entry.expiry_date ?? null}
            onChange={(d) => onChange({ expiry_date: d })}
            placeholder="—"
            clearable
            ariaLabel="Expiry date"
          />
        </span>
      </p>

      <p className="resume-entry-microtype mt-1">
        <InlineTextField
          value={entry.credential_url ?? ""}
          onChange={(v) => onChange({ credential_url: v || null })}
          placeholder="https://… (credential URL)"
          aria-label="Credential URL"
        />
      </p>
    </EditableEntry>
  );
});
