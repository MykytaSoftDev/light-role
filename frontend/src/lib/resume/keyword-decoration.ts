/**
 * TAILOR-12 — Tiptap extension that paints keyword highlights via ProseMirror
 * Decorations.
 *
 * Spec: docs/v2/specs/insights-panel-spec.md §4.
 *
 * Why Decoration not Mark:
 *   - Decorations live in the editor's view layer ONLY. `editor.getHTML()`
 *     returns clean HTML — no decoration markup leaks into the saved doc.
 *   - DOMPurify sees nothing to strip (the whitelist stays tight).
 *   - No schema/transaction churn for highlight updates.
 *
 * Recompute strategy: debounced on blur (300ms). Initial paint runs once when
 * the plugin mounts (so highlights appear immediately on Edit-mode entry).
 *
 * Matching rules (per spec §4.5):
 *   - Whole-word, case-insensitive.
 *   - Word boundary class `[\w./+#-]` so `Node.js`, `CI/CD`, `C++`, `C#` all
 *     register as one token.
 *   - Sorted longer-first to handle overlap (`Node` inside `Node.js`).
 *   - Per-color: each keyword carries its `color_id`; ranges record it so the
 *     decoration `<span>` gets the matching `data-color-id` attribute.
 */
import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

import { paletteIndex } from "./keyword-palette";

export interface KeywordDecorationConfig {
  term: string;
  color_id: number;
}

const keywordDecorationPluginKey = new PluginKey<DecorationSet>(
  "keywordDecoration"
);

const RECOMPUTE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find all keyword occurrences in `text`. Sorts longer-first and tracks an
 * occupied-interval set so overlapping matches collapse to the longest.
 */
function findKeywordRangesInText(
  text: string,
  keywords: KeywordDecorationConfig[]
): Array<{ from: number; to: number; color_id: number }> {
  const sorted = [...keywords].sort((a, b) => b.term.length - a.term.length);
  const ranges: Array<{ from: number; to: number; color_id: number }> = [];
  const occupied: Array<[number, number]> = [];

  for (const kw of sorted) {
    if (!kw.term) continue;
    const rx = new RegExp(
      `(?<![\\w./+#-])${escapeRegex(kw.term)}(?![\\w./+#-])`,
      "gi"
    );
    for (const m of text.matchAll(rx)) {
      const from = m.index!;
      const to = from + m[0].length;
      // Skip if overlaps an already-claimed range (longer-first guarantee).
      if (occupied.some(([a, b]) => from < b && to > a)) continue;
      ranges.push({ from, to, color_id: kw.color_id });
      occupied.push([from, to]);
    }
  }
  return ranges.sort((a, b) => a.from - b.from);
}

/**
 * Walk the ProseMirror doc, collect each text node with its absolute position,
 * then run the matcher on each text node's content. We match on each text node
 * INDIVIDUALLY rather than on a concatenated string so the resulting positions
 * map cleanly back to PM positions without any re-mapping.
 *
 * This means a keyword that spans across two text nodes (e.g. across a `<br>`
 * or split by a mark boundary) will NOT match — but that's fine because:
 *   1. The Tiptap whitelist allows only `bold`/`italic` marks; a keyword
 *      doesn't usually straddle a bold/italic boundary.
 *   2. The cost of a real cross-node matcher (textBetween + offset map) is
 *      much higher and the benefit is negligible for the resume domain.
 */
function buildDecorations(
  doc: PMNode,
  keywords: KeywordDecorationConfig[]
): DecorationSet {
  if (!keywords.length) return DecorationSet.empty;
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const ranges = findKeywordRangesInText(node.text, keywords);
    for (const r of ranges) {
      decos.push(
        Decoration.inline(pos + r.from, pos + r.to, {
          class: `keyword-decoration keyword-mark-${paletteIndex(r.color_id)}`,
          "data-color-id": String(paletteIndex(r.color_id)),
        })
      );
    }
    return true;
  });

  return DecorationSet.create(doc, decos);
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Build a Tiptap Extension that registers the ProseMirror Decoration plugin.
 *
 * The plugin holds a ref to the latest keyword set inside the extension
 * closure. Recomputes happen:
 *   - synchronously on mount (initial paint)
 *   - debounced 300ms after blur (or after an external `setContent`).
 *
 * To trigger a recompute, the plugin appends a meta-tagged transaction;
 * `apply()` reads the meta and rebuilds the DecorationSet against the current
 * doc.
 */
export function createKeywordHighlightExtension(
  keywords: KeywordDecorationConfig[]
) {
  return Extension.create({
    name: "keywordHighlight",

    addProseMirrorPlugins() {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let lastDocSize = -1;

      const recompute = (
        view: { state: EditorState; dispatch: (tr: Transaction) => void }
      ) => {
        view.dispatch(view.state.tr.setMeta(keywordDecorationPluginKey, true));
      };

      return [
        new Plugin<DecorationSet>({
          key: keywordDecorationPluginKey,

          state: {
            init(_config, state) {
              lastDocSize = state.doc.content.size;
              return buildDecorations(state.doc, keywords);
            },
            apply(tr, oldSet) {
              const meta = tr.getMeta(keywordDecorationPluginKey);
              if (meta === true) {
                // Explicit recompute (debounced from blur or from setContent).
                lastDocSize = tr.doc.content.size;
                return buildDecorations(tr.doc, keywords);
              }
              if (tr.docChanged) {
                // Map decorations forward through the change so highlights
                // stay anchored to text positions while the user types. We
                // do NOT recompute matches here — that's debounced to blur.
                return oldSet.map(tr.mapping, tr.doc);
              }
              return oldSet;
            },
          },

          props: {
            decorations(state) {
              return keywordDecorationPluginKey.getState(state);
            },
            handleDOMEvents: {
              blur(view) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  debounceTimer = null;
                  recompute(view);
                }, RECOMPUTE_DEBOUNCE_MS);
                return false;
              },
              focus() {
                // Cancel any pending blur recompute when refocusing — we'll
                // schedule a new one on the next blur.
                if (debounceTimer) {
                  clearTimeout(debounceTimer);
                  debounceTimer = null;
                }
                return false;
              },
            },
          },

          view() {
            // External setContent (e.g. parent re-syncs `value` after save):
            // the editor view re-mounts the doc but our debounce is keyed on
            // user-visible blur. Detect a doc-size jump that wasn't authored
            // and recompute synchronously.
            return {
              update(updatedView) {
                const newSize = updatedView.state.doc.content.size;
                // If the size changed by more than a "typing" amount in a
                // single update AND the editor isn't focused, treat it as an
                // external content swap and recompute right away.
                if (
                  Math.abs(newSize - lastDocSize) > 4 &&
                  !updatedView.hasFocus()
                ) {
                  recompute(updatedView);
                }
                // We always update lastDocSize so the heuristic stays current.
                lastDocSize = newSize;
              },
              destroy() {
                if (debounceTimer) {
                  clearTimeout(debounceTimer);
                  debounceTimer = null;
                }
              },
            };
          },
        }),
      ];
    },
  });
}
