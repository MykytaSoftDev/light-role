"use client";

import { Button } from "@/components/ui/button";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

interface EntryListItem {
  // Optional at the type level because the underlying domain types
  // (EmploymentEntry, etc.) keep `id` optional for client-side new entries
  // pre-submit. In practice, by the time items reach EntryList they MUST have
  // an id — `useSectionEntries` stamps a UUID on hydration, and modal Save
  // handlers stamp one before calling `saveEntries`. Anything reaching this
  // component without an id is a bug — DnD wiring needs matching, non-empty
  // ids on both SortableContext and each useSortable.
  id?: string;
}

interface EntryListProps<T extends EntryListItem> {
  items: T[];
  onReorder: (next: T[]) => void;
  renderCard: (item: T, index: number) => ReactNode;
  onAdd: () => void;
  addButtonLabel: string;
  emptyMessage: string;
  heading: string;
  description: string;
}

/**
 * Generic list wrapper for the 6 card-list profile tabs.
 *
 * - Wires `<DndContext>` + `<SortableContext>` for vertical reordering.
 * - Renders the section heading, description, "+ Add" button (top-right),
 *   the sortable cards, and an empty-state placeholder.
 *
 * Each item must already have a stable string `id`. New items get a
 * crypto.randomUUID() before they reach this component.
 */
export function EntryList<T extends EntryListItem>({
  items,
  onReorder,
  renderCard,
  onAdd,
  addButtonLabel,
  emptyMessage,
  heading,
  description,
}: EntryListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  // Defensive: dev-time warning if we ever land here with a missing id.
  // We still emit a (non-empty) fallback so React keys + dnd-kit don't break
  // visually, but this signals a hydration bug upstream.
  const ids = items.map((it, idx) => {
    if (!it.id) {
      // eslint-disable-next-line no-console
      console.warn(
        "[EntryList] item missing id — DnD will not work for this entry; " +
          "useSectionEntries should have stamped one on hydration",
        { index: idx }
      );
      return `__missing_${idx}`;
    }
    return it.id;
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={ids[index]}>{renderCard(item, index)}</li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
