/**
 * TAILOR-12 — Keyword palette helpers.
 *
 * Spec: docs/v2/specs/insights-panel-spec.md §2.5.
 *
 * The Insights side panel chips and the in-editor decoration plugin share an
 * 8-color palette keyed by `MatchedKeyword.color_id`. The backend is free to
 * emit any positive integer; the panel modulos to 1..8 so the visual stays
 * stable and predictable.
 *
 * Both consumers (chip className `keyword-chip--N` and decoration attribute
 * `[data-color-id="N"]`) read CSS variables from globals.css, so the palette
 * lives in CSS — these helpers only translate `color_id` → palette index.
 */
export const KEYWORD_PALETTE_SIZE = 8;

export type PaletteIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Map a backend color_id (1..N) to a stable palette index 1..8.
 *
 * Defensive: clamps non-finite / non-positive ids to 1 so the chip never
 * renders without a color.
 */
export function paletteIndex(colorId: number): PaletteIndex {
  if (!Number.isFinite(colorId) || colorId < 1) return 1;
  return (((Math.floor(colorId) - 1) % KEYWORD_PALETTE_SIZE) + 1) as PaletteIndex;
}

/** Convenience: build the chip className for a given color_id. */
export function paletteChipClassName(colorId: number): string {
  return `keyword-chip--${paletteIndex(colorId)}`;
}
