"use client";

/**
 * TAILOR-12 — Matched Keywords block (Insights panel, block 1).
 *
 * Spec: docs/v2/specs/insights-panel-spec.md §2.
 *
 * Renders the heading + count badge + chip grid. Chips are buttons; in Edit
 * mode they scroll the first occurrence of the term into view via the
 * KeywordScrollContext. In Preview mode they render with `disabled` so they
 * stay visually identical but are non-interactive (the Preview document has
 * no Tiptap editors to scroll to).
 */
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";
import {
  paletteChipClassName,
  paletteIndex,
} from "@/lib/resume/keyword-palette";
import { useKeywordScroll } from "@/lib/resume/keyword-scroll-context";

interface MatchedKeywordsProps {
  keywords: MatchedKeyword[];
  /** When true, chips are interactive (click → scroll to occurrence). */
  isEditMode: boolean;
}

export function MatchedKeywords({ keywords, isEditMode }: MatchedKeywordsProps) {
  const scroll = useKeywordScroll();

  const handleChipClick = React.useCallback(
    (term: string) => {
      if (!scroll) return;
      const hit = scroll.findFirstOccurrence(term);
      if (!hit) {
        toast.info("No occurrences in the current draft.");
        return;
      }
      const { editor, from } = hit;
      // Focus + place caret + scroll into view. `chain()` batches the focus
      // and selection updates into a single transaction.
      editor
        .chain()
        .focus()
        .setTextSelection(from)
        .scrollIntoView()
        .run();
      // Also use the DOM scrollIntoView so the page (not just the editor view)
      // scrolls when the editor is far off-screen.
      try {
        const dom = editor.view.dom as HTMLElement;
        dom.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // ignore — defensive
      }
    },
    [scroll]
  );

  if (!keywords || keywords.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold tracking-tight mb-2">
          Matched keywords
        </h3>
        <p className="text-sm text-muted-foreground">
          No keywords matched yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-tight">
          Matched keywords
        </h3>
        <Badge variant="secondary">{keywords.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw, idx) => {
          const colorIdx = paletteIndex(kw.color_id);
          return (
            <button
              key={`${kw.term}-${idx}-${colorIdx}`}
              type="button"
              className={`keyword-chip ${paletteChipClassName(kw.color_id)}`}
              onClick={
                isEditMode ? () => handleChipClick(kw.term) : undefined
              }
              disabled={!isEditMode}
              title={kw.term}
              aria-label={
                isEditMode
                  ? `Scroll to first occurrence of ${kw.term}`
                  : kw.term
              }
            >
              <span className="max-w-[200px] truncate">{kw.term}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
