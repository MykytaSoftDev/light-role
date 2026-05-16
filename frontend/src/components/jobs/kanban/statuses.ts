// ---------------------------------------------------------------------------
// Shared job status constants.
//
// Single source of truth for the 8 application statuses and the `Status`
// union derived from them. Imported by both:
//   - app/(dashboard)/dashboard/jobs/page.tsx (Kanban + Table views)
//   - components/jobs/kanban/KanbanBoard.tsx  (8-column horizontal-scroll board)
//
// Order matters: this is the canonical column order rendered left-to-right
// in the Kanban board and the canonical iteration order used by the page's
// groupByStatus / flattenJobsMap / findContainer helpers.
//
// Note: app/(dashboard)/dashboard/jobs/[id]/page.tsx maintains its OWN local
// STATUSES constant — that file is the per-job detail page and is intentionally
// decoupled from the list/board surface.
// ---------------------------------------------------------------------------

export const STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];
