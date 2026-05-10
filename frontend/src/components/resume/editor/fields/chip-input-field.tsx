"use client";

/**
 * TAILOR-10 — Chip input field.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.7.
 *
 * Used for: skills, languages, projects[].technologies. Each chip is a
 * standalone string; the parent maps to/from the schema's per-section type.
 *
 * Behaviors:
 *   - Type + Enter (or comma) commits the input as a new chip.
 *   - Click X on a chip removes it.
 *   - Backspace on empty input removes the last chip.
 *   - Drag-to-reorder via dnd-kit horizontal sortable.
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X as XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChipInputFieldProps {
  /**
   * The chips. Caller passes stable identifiers; the component does NOT
   * generate them (so the parent can keep its `{id, name}` schema as-is).
   */
  values: Array<{ id: string; label: string }>;
  /** Add a new chip (caller decides the id — typically crypto.randomUUID()). */
  onAdd: (label: string) => void;
  /** Remove the chip with the given id. */
  onRemove: (id: string) => void;
  /** Reorder — caller updates its underlying array order to match. */
  onReorder: (nextIds: string[]) => void;
  placeholder?: string;
  /** Visual size — `xs` for inline tech tags inside Projects. */
  size?: "sm" | "xs";
  /** Optional aria-label for the input. */
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function ChipInputField({
  values,
  onAdd,
  onRemove,
  onReorder,
  placeholder,
  size = "sm",
  ariaLabel,
  className,
  disabled = false,
}: ChipInputFieldProps) {
  const t = useTranslations("Resumes.editor.fields");
  const resolvedPlaceholder = placeholder ?? t("chipPlaceholder");
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, "").trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(input);
      return;
    }
    if (e.key === ",") {
      e.preventDefault();
      commit(input);
      return;
    }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      e.preventDefault();
      onRemove(values[values.length - 1].id);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = values.map((v) => v.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder(arrayMove(ids, oldIdx, newIdx));
  }

  const ids = values.map((v) => v.id);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5",
        "focus-within:border-primary",
        size === "xs" && "px-1.5 py-1 gap-0.5",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          {values.map((v) => (
            <Chip
              key={v.id}
              id={v.id}
              label={v.label}
              size={size}
              onRemove={() => onRemove(v.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Commit dangling text on blur so the user doesn't lose what they
          // typed when clicking elsewhere.
          if (input.trim()) commit(input);
        }}
        placeholder={values.length === 0 ? resolvedPlaceholder : ""}
        aria-label={ariaLabel ?? t("addChip")}
        className={cn(
          "flex-1 min-w-[6rem] bg-transparent outline-none",
          size === "xs" ? "text-xs" : "text-sm"
        )}
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip (sortable)
// ---------------------------------------------------------------------------

interface ChipProps {
  id: string;
  label: string;
  size: "sm" | "xs";
  onRemove: () => void;
}

function Chip({ id, label, size, onRemove }: ChipProps) {
  const t = useTranslations("Resumes.editor.fields");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md border bg-secondary text-secondary-foreground",
        size === "xs" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        aria-label={t("dragChipAria", { label })}
        className="cursor-grab touch-none text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      <span className="leading-none">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("removeChipAria", { label })}
        className="rounded text-muted-foreground/70 hover:text-destructive"
      >
        <XIcon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
    </span>
  );
}
