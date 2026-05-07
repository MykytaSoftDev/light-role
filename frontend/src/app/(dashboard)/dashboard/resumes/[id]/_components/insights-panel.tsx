"use client";

/**
 * TAILOR-12 — Insights side panel.
 *
 * Spec: docs/v2/specs/insights-panel-spec.md.
 *
 * Replaces `<InsightsPanelPlaceholder />`. Renders a sticky `<Card>` with two
 * stacked blocks:
 *   1. Matched Keywords — color-coded chips, count badge.
 *   2. Applied Changes — accordion listing AI changes per section.
 *
 * Edit-mode behaviour:
 *   - Card dims to opacity 0.7 (200ms transition).
 *   - Tooltip "Insights are read-only while editing." on Card hover.
 *   - Chips and accordion stay interactive (per spec §5.3 — the panel data is
 *     immutable but the UI helps the user navigate while editing).
 *
 * Layout:
 *   - Sticky `top-6` at 2xl with `max-h-[calc(100vh-6rem)] overflow-y-auto`.
 *   - Stacks below the document at <2xl (handled by parent grid).
 */
import * as React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  AppliedChanges,
  MatchedKeyword,
} from "@/lib/tailored-resume-api";

import { MatchedKeywords } from "./matched-keywords";
import { AppliedChangesAccordion } from "./applied-changes-accordion";

interface InsightsPanelProps {
  matchedKeywords: MatchedKeyword[];
  appliedChanges: AppliedChanges;
  /** Live (draft) sections order — accordion follows this. */
  sectionsOrder: string[];
  /** Edit mode → dims panel + enables tooltip. */
  isEditMode: boolean;
}

export function InsightsPanel({
  matchedKeywords,
  appliedChanges,
  sectionsOrder,
  isEditMode,
}: InsightsPanelProps) {
  const card = (
    <Card
      className={cn(
        "max-h-[calc(100vh-6rem)] overflow-y-auto",
        "transition-opacity duration-200",
        isEditMode && "opacity-70"
      )}
    >
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MatchedKeywords
          keywords={matchedKeywords ?? []}
          isEditMode={isEditMode}
        />
        <Separator />
        <AppliedChangesAccordion
          appliedChanges={appliedChanges ?? {}}
          sectionsOrder={sectionsOrder}
        />
      </CardContent>
    </Card>
  );

  return (
    <aside
      role="complementary"
      aria-label="Insights"
      className="sticky top-6"
    >
      {isEditMode ? (
        <Tooltip>
          {/*
            Wrap the card in a div so the tooltip trigger can attach to a
            single element without overriding Card's ref. We don't use
            asChild — that would cause Radix to merge props onto the Card,
            which forwards refs but not arbitrary event handlers.
           */}
          <TooltipTrigger asChild>
            <div>{card}</div>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            Insights are read-only while editing.
          </TooltipContent>
        </Tooltip>
      ) : (
        card
      )}
    </aside>
  );
}
