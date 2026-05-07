"use client";

/**
 * TAILOR-10 — Editable preview wrapper.
 *
 * Mirrors `<ResumePreview>` (the read-only browser preview) but renders an
 * `<EditableTemplate>` instead of a `<ClassicTemplate>`. Reuses the same
 * scaling-tier logic so the document looks identical at every breakpoint.
 *
 * Used by `editor-shell.tsx` when `mode === "edit"`. When `mode === "preview"`
 * the shell still renders `<ResumePreview>` directly (no behavior change).
 */
import * as React from "react";

import type { ProfileData } from "@/lib/profile-api";
import type { ResumeFont } from "@/lib/fonts/resume-fonts";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";

import { EditableTemplate } from "./editable-template";

export interface EditablePreviewProps {
  data: ProfileData;
  font: ResumeFont;
  sections_order: string[];
  onChange: (data: ProfileData) => void;
  onValidityChange?: (isValid: boolean) => void;
  /** Optional explicit scale override (rarely needed). */
  scale?: number;
  className?: string;
  /**
   * Optional content rendered INSIDE the canvas, above the document, with
   * its width matched to the visually-scaled document width. Used by the
   * editor shell to host the Edit-mode toolbar so it sits on the canvas
   * just above the page.
   */
  topSlot?: React.ReactNode;
  /**
   * TAILOR-12 — Matched keywords from the AI tailor pipeline, threaded down
   * to each Tiptap editor for inline highlighting.
   */
  keywords?: MatchedKeyword[];
}

// Mirrors the constants in resume-preview.tsx — the canvas math is identical
// for both the read-only preview and the editable preview.
const DOC_WIDTH_PX = 794; // 210mm × 3.7795 px/mm
const CANVAS_PADDING_PX = 64; // p-8 × 2
const MIN_SCALE = 0.4;

/**
 * Container-driven scale: observes the canvas and picks the largest scale
 * that fits the document inside the available width (canvas content area).
 * Replaces the old window-width-based tiers — those didn't account for the
 * dashboard sidebar + side panel that compress the actual cell.
 */
function useContainerScale(
  ref: React.RefObject<HTMLElement | null>
): number {
  const [scale, setScale] = React.useState<number>(1.0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (!ref.current) return;
      const available = ref.current.clientWidth - CANVAS_PADDING_PX;
      const next = Math.max(
        MIN_SCALE,
        Math.min(1.0, available / DOC_WIDTH_PX)
      );
      setScale(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return scale;
}

export function EditablePreview({
  data,
  font,
  sections_order,
  onChange,
  onValidityChange,
  scale: scaleOverride,
  className,
  topSlot,
  keywords,
}: EditablePreviewProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const autoScale = useContainerScale(canvasRef);
  const scale = scaleOverride ?? autoScale;

  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [frameMinHeight, setFrameMinHeight] = React.useState<number | null>(
    null
  );

  React.useEffect(() => {
    if (!innerRef.current) return;
    const target = innerRef.current;
    const apply = () => {
      setFrameMinHeight(target.scrollHeight * scale);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(target);
    return () => ro.disconnect();
  }, [scale, data, sections_order, font]);

  return (
    <div
      ref={canvasRef}
      className={
        "bg-gray-100 dark:bg-background p-8 flex flex-col items-center gap-4 " +
        (className ?? "")
      }
    >
      {topSlot ? (
        <div
          className="flex"
          // Match the visually-scaled document width so the slot's edges
          // align with the page edges below it (px = 210mm × scale).
          style={{ width: `calc(210mm * ${scale})` }}
        >
          {topSlot}
        </div>
      ) : null}
      <div
        className="resume-preview-frame"
        style={
          frameMinHeight != null ? { minHeight: frameMinHeight } : undefined
        }
      >
        <div
          className="shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-sm"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            width: "210mm",
          }}
          ref={innerRef}
        >
          <EditableTemplate
            data={data}
            font={font}
            sections_order={sections_order}
            onChange={onChange}
            onValidityChange={onValidityChange}
            keywords={keywords}
          />
        </div>
      </div>
    </div>
  );
}
