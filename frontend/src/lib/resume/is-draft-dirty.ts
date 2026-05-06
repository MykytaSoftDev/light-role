/**
 * TAILOR-9 — Stable-stringify based draft dirty detection.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §1.4.
 *
 * `TailoredResumeData` is a plain JSON-shaped object (no Dates, no class
 * instances, no functions). Stable-stringify is fast (single pass), produces
 * no false positives from key-order shuffling, and avoids introducing a new
 * deep-equality dep. We DO NOT add `lodash.isEqual` — see spec §13 #9.
 *
 * Used by: useResumeDraft (Save-button enable, Cancel guard), beforeunload
 * handler, navigation guard.
 */
import type { ProfileData } from "@/lib/profile-api";

export interface EditableSnapshot {
  tailored_data: ProfileData;
  sections_order_snapshot: string[];
  font_snapshot: string;
}

/**
 * Recursively stringifies `value` with object keys sorted alphabetically at
 * every level. Arrays preserve order (order is meaningful for sections, lists,
 * etc.). The result is stable across key-insertion-order shuffles.
 *
 * Implementation note: builds a new object with sorted keys then defers to
 * `JSON.stringify`. Recursion depth bounded by data shape (resume documents
 * are shallow — max ~6 levels) so we don't worry about stack overflows.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    out[k] = canonicalize(obj[k]);
  }
  return out;
}

/**
 * Returns true iff the draft has diverged from the snapshot in any of the
 * three editable surfaces (tailored_data, sections_order_snapshot,
 * font_snapshot).
 */
export function isDraftDirty(
  draft: EditableSnapshot,
  snapshot: EditableSnapshot
): boolean {
  if (draft.font_snapshot !== snapshot.font_snapshot) return true;
  if (
    stableStringify(draft.sections_order_snapshot) !==
    stableStringify(snapshot.sections_order_snapshot)
  ) {
    return true;
  }
  if (
    stableStringify(draft.tailored_data) !==
    stableStringify(snapshot.tailored_data)
  ) {
    return true;
  }
  return false;
}
