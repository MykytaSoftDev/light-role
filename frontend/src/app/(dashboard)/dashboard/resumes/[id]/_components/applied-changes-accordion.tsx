"use client";

/**
 * TAILOR-12 — Applied Changes accordion (Insights panel, block 2).
 *
 * Spec: docs/v2/specs/insights-panel-spec.md §3.
 *
 * Renders one row per section in `liveSectionsOrder`. Sections that have at
 * least one entry in `applied_changes` render as expandable green-tinted
 * AccordionItems with a checkmark. Sections without changes render as muted,
 * non-expandable rows so the panel structure stays consistent.
 *
 * Section labels are imported from `reorder-sections-dialog.tsx` (single
 * source of truth — see spec §3.6). `personal_info` is intentionally
 * excluded since it's not in any reorderable list.
 */
import * as React from "react";
import { Check } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AppliedChanges } from "@/lib/tailored-resume-api";

import {
  SECTION_LABELS,
  type ReorderableSectionKey,
} from "./reorder-sections-dialog";

interface AppliedChangesAccordionProps {
  appliedChanges: AppliedChanges;
  /** Live draft sections order — accordion follows this order. */
  sectionsOrder: string[];
}

function isReorderableKey(key: string): key is ReorderableSectionKey {
  return key in SECTION_LABELS;
}

export function AppliedChangesAccordion({
  appliedChanges,
  sectionsOrder,
}: AppliedChangesAccordionProps) {
  // Filter and dedupe sectionsOrder to known keys; if the order is empty,
  // fall back to the default 9-section order so the user still sees
  // every row (even if all unchanged).
  const orderedKeys = React.useMemo(() => {
    const seen = new Set<string>();
    const out: ReorderableSectionKey[] = [];
    for (const k of sectionsOrder) {
      if (isReorderableKey(k) && !seen.has(k)) {
        out.push(k);
        seen.add(k);
      }
    }
    if (out.length === 0) {
      // Fallback: the default 9 in their canonical order (matches the
      // editor-shell default).
      return [
        "summary",
        "employment",
        "education",
        "skills",
        "languages",
        "projects",
        "certificates",
        "achievements",
        "volunteer",
      ] as ReorderableSectionKey[];
    }
    return out;
  }, [sectionsOrder]);

  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight mb-3">
        Applied changes
      </h3>

      <Accordion type="multiple" className="space-y-1.5">
        {orderedKeys.map((key) => {
          const changes = appliedChanges?.[key];
          const hasChanges =
            Array.isArray(changes) && changes.length > 0;

          if (hasChanges) {
            return (
              <AccordionItem
                key={key}
                value={key}
                // Override the shadcn default border-b to match our pill rows.
                className="border-0"
              >
                <AccordionTrigger
                  className={
                    "flex items-center gap-2 rounded-md " +
                    "bg-emerald-50 dark:bg-emerald-950/30 " +
                    "border border-emerald-200/60 dark:border-emerald-900/50 " +
                    "px-3 py-2 text-sm font-medium " +
                    "text-emerald-900 dark:text-emerald-100 " +
                    "hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 " +
                    "hover:no-underline transition-colors"
                  }
                >
                  <span className="flex flex-1 items-center gap-2">
                    <Check
                      className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <span>{SECTION_LABELS[key]}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent
                  className={
                    "rounded-b-md " +
                    "px-3 py-2 -mt-1 " +
                    "border border-t-0 border-emerald-200/60 dark:border-emerald-900/50 " +
                    "bg-emerald-50/40 dark:bg-emerald-950/20"
                  }
                >
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground leading-snug">
                    {changes.map((line, i) => (
                      <li key={`${key}-change-${i}`}>{line}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          }

          // Unchanged section — flat muted row, non-interactive.
          return (
            <div
              key={key}
              className={
                "flex items-center gap-2 rounded-md " +
                "bg-muted/40 border border-border " +
                "px-3 py-2 text-sm text-muted-foreground cursor-default"
              }
            >
              <span>{SECTION_LABELS[key]}</span>
            </div>
          );
        })}
      </Accordion>
    </div>
  );
}
