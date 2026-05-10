"use client";

/**
 * TAILOR-10 — Projects section editor.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.8.
 *
 * Per entry:
 *   Row 1: name | start_date – end_date / "Present" | is_current
 *   Row 2: role · technologies (chip input, xs)
 *   Row 3: url · repository_url
 *   Row 4: bullets (Tiptap, list[str])
 *   Row 5: description (Tiptap paragraph)
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
import type { ProjectEntry } from "@/lib/profile-api";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { EditableEntry } from "../editable-entry";
import { EditableSection } from "../editable-section";
import { InlineTextField } from "../fields/inline-text-field";
import { MonthInput } from "../fields/month-input";
import { ChipInputField } from "../fields/chip-input-field";
import {
  TiptapField,
  bulletListFromStrings,
  htmlToBulletList,
} from "../fields/tiptap-field";

interface ProjectsEditorProps {
  value: ProjectEntry[];
  onChange: (next: ProjectEntry[]) => void;
  focusEntryId?: string | null;
  onFocusApplied?: () => void;
  /** TAILOR-12 — keyword highlighting (forwarded to TiptapField). */
  keywords?: MatchedKeyword[];
}

export function ProjectsEditor({
  value,
  onChange,
  focusEntryId,
  onFocusApplied,
  keywords,
}: ProjectsEditorProps) {
  const tSection = useTranslations("Resumes.sectionTitles");
  const tProfile = useTranslations("profile.projects");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleAdd() {
    const newEntry: ProjectEntry = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      role: null,
      start_date: null,
      end_date: null,
      is_current: false,
      technologies: [],
      url: null,
      repository_url: null,
      details: [],
    };
    onChange([...value, newEntry]);
  }

  function handleEntryChange(id: string, patch: Partial<ProjectEntry>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function handleRemove(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = value.map((p) => p.id ?? "");
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  }

  const ids = value.map((p) => p.id ?? "");

  return (
    <EditableSection
      title={tSection("projects")}
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
            <ProjectEntryEditor
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

interface ProjectEntryEditorProps {
  entry: ProjectEntry;
  autoFocus: boolean;
  onAutoFocusApplied?: () => void;
  onChange: (patch: Partial<ProjectEntry>) => void;
  onRemove: () => void;
  keywords?: MatchedKeyword[];
}

const ProjectEntryEditor = React.memo(function ProjectEntryEditor({
  entry,
  autoFocus,
  onAutoFocusApplied,
  onChange,
  onRemove,
  keywords,
}: ProjectEntryEditorProps) {
  const tProfile = useTranslations("profile.projects");
  const tEmployment = useTranslations("profile.employment");
  const tEditor = useTranslations("Resumes.editor.section");
  const nameRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      nameRef.current?.focus();
      onAutoFocusApplied?.();
    }
  }, [autoFocus, onAutoFocusApplied]);

  const initialBullets = React.useMemo(
    () => bulletListFromStrings(entry.details ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id]
  );

  // Technologies chips — convert to/from string[].
  const techChips = React.useMemo(() => {
    return (entry.technologies ?? []).map((t, idx) => ({
      id: `${entry.id}-tech-${idx}-${t}`,
      label: t,
    }));
    // We rebuild ids per render but DnD's during-drag id tracking is fine
    // because we update the whole `technologies` array on reorder.
  }, [entry.id, entry.technologies]);

  return (
    <EditableEntry
      id={entry.id ?? "__missing"}
      label={tEditor("projectEntryLabel")}
      onRemove={onRemove}
    >
      <div className="resume-entry-row flex items-baseline justify-between gap-4">
        <div className="resume-entry-row-left flex-1 min-w-0">
          <span className="resume-entry-title">
            <InlineTextField
              ref={nameRef}
              value={entry.name}
              onChange={(name) => onChange({ name })}
              placeholder={tProfile("name")}
              aria-label={tProfile("name")}
            />
          </span>
        </div>
        <div className="resume-entry-row-right flex items-center gap-1">
          <span className="resume-entry-meta inline-flex items-center gap-1">
            <MonthInput
              value={entry.start_date ?? null}
              onChange={(d) => onChange({ start_date: d })}
              placeholder={tEditor("startShort")}
              clearable
              ariaLabel={tProfile("startDate")}
            />
            <span className="text-muted-foreground/70">–</span>
            {entry.is_current ? (
              <span className="px-1 text-sm">{tEmployment("present")}</span>
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

      <p className="resume-entry-subtitle flex flex-wrap items-baseline gap-x-2">
        <InlineTextField
          value={entry.role ?? ""}
          onChange={(v) => onChange({ role: v || null })}
          placeholder={tProfile("role")}
          aria-label={tProfile("role")}
        />
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <span className="flex-1 min-w-[12rem]">
          <ChipInputField
            size="xs"
            placeholder={tEditor("addTechnologyPlaceholder")}
            ariaLabel={tProfile("technologies")}
            values={techChips}
            onAdd={(label) =>
              onChange({ technologies: [...(entry.technologies ?? []), label] })
            }
            onRemove={(id) => {
              const idx = techChips.findIndex((c) => c.id === id);
              if (idx === -1) return;
              const next = [...(entry.technologies ?? [])];
              next.splice(idx, 1);
              onChange({ technologies: next });
            }}
            onReorder={(nextIds) => {
              const byId = new Map(
                techChips.map((c) => [c.id, c.label])
              );
              const reordered = nextIds
                .map((id) => byId.get(id))
                .filter(Boolean) as string[];
              onChange({ technologies: reordered });
            }}
          />
        </span>
      </p>

      <p className="resume-entry-microtype mt-1 flex flex-wrap items-baseline gap-x-2">
        <InlineTextField
          value={entry.url ?? ""}
          onChange={(v) => onChange({ url: v || null })}
          placeholder={tEditor("liveUrlPlaceholder")}
          aria-label={tProfile("url")}
        />
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <InlineTextField
          value={entry.repository_url ?? ""}
          onChange={(v) => onChange({ repository_url: v || null })}
          placeholder={tEditor("repositoryPlaceholder")}
          aria-label={tProfile("repositoryUrl")}
        />
      </p>

      <div className="mt-1">
        <TiptapField
          value={initialBullets}
          onChange={(html) => onChange({ details: htmlToBulletList(html) })}
          enableBulletList
          placeholder={tEditor("projectBulletPlaceholder")}
          ariaLabel={tProfile("details")}
          keywords={keywords}
        />
      </div>

      <div className="resume-entry-body mt-1">
        <TiptapField
          value={entry.description ?? ""}
          onChange={(html) => onChange({ description: html })}
          enableBulletList={false}
          placeholder={tEditor("describeProjectPlaceholder")}
          ariaLabel={tProfile("description")}
          keywords={keywords}
        />
      </div>
    </EditableEntry>
  );
});
