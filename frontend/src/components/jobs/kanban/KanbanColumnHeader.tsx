// ---------------------------------------------------------------------------
// KanbanColumnHeader — monospace label + counter for a single kanban column.
//
// SPEC §Column Header: flex row, justify-between, items-center, pb-3 mb-2.
// Both label and count use `font-mono text-xs uppercase tracking-widest
// text-muted-foreground`. The wide tracking is non-negotiable — it's what
// makes the typography feel like the reference mockup. No underline, no
// divider; whitespace alone separates the header from cards.
// ---------------------------------------------------------------------------

interface KanbanColumnHeaderProps {
  label: string;
  count: number;
}

export function KanbanColumnHeader({ label, count }: KanbanColumnHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-3 mb-2">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {count}
      </span>
    </div>
  );
}
