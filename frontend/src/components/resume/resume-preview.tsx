"use client";

/**
 * Browser-preview wrapper for `ClassicTemplate`. Adds the editor canvas
 * chrome described in the spec §2 and the responsive scaling tiers from §9.
 *
 * All chrome (background, drop-shadow, scaling) lives here — never inside
 * `ClassicTemplate`. The PDF render path imports `ClassicTemplate` directly
 * and bypasses this wrapper, so anything visual added here will NOT appear
 * in PDF output.
 */
import * as React from "react";

import {
  ClassicTemplate,
  type ClassicTemplateProps,
} from "@/components/resume/classic-template";

export interface ResumePreviewProps extends ClassicTemplateProps {
  /** Override the auto-computed scale tier (debug / explicit Edit-mode 0.5). */
  scale?: number;
  /** Optional className for the outermost canvas wrapper. */
  className?: string;
  /**
   * Optional content rendered INSIDE the canvas, above the document, with
   * its width matched to the visually-scaled document width. Used by the
   * editor shell to host the Edit button (Preview mode) and the Edit-mode
   * toolbar so they sit on the canvas just above the page.
   */
  topSlot?: React.ReactNode;
}

// 210mm × 3.7795275591 px/mm = 793.7 → the doc's natural layout width.
const DOC_WIDTH_PX = 794;
// Canvas padding (Tailwind p-8 = 32px each side).
const CANVAS_PADDING_PX = 64;
// Smallest scale we let the user fall to before the document becomes
// unreadable. Keeps mobile usable.
const MIN_SCALE = 0.4;

/**
 * useContainerScale: observes the canvas element's content box and returns
 * the scale that fits the document inside the available width. Replaces the
 * old viewport-based tiers — those didn't account for the dashboard sidebar
 * + side panel, which compress the actual cell well below the viewport.
 *
 * Defaults to 1.0 during SSR; first measurement happens in useLayoutEffect
 * so the user does not see a 1.0 → real-scale flash.
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

export function ResumePreview(props: ResumePreviewProps) {
  const { scale: scaleOverride, className, today, topSlot, ...templateProps } = props;
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const autoScale = useContainerScale(canvasRef);
  const scale = scaleOverride ?? autoScale;
  // Pure: compute "today" once at mount instead of `Date.now()` in every render.
  const [todayIso] = React.useState<string>(
    () => today ?? new Date().toISOString().slice(0, 10)
  );

  // The scaling layer wraps the ClassicTemplate's natural-size element
  // (210mm wide). After applying transform: scale(N), the wrapper still
  // occupies the un-scaled height in the DOM unless we compensate. We use a
  // ResizeObserver on the inner element to read its un-scaled height and
  // apply scaled height as min-height on the frame.
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [frameMinHeight, setFrameMinHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!innerRef.current) return;
    const target = innerRef.current;
    const apply = () => {
      // scrollHeight reads the natural (un-scaled) height of the document.
      setFrameMinHeight(target.scrollHeight * scale);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(target);
    return () => ro.disconnect();
  }, [scale, props.data, props.sections_order, props.font, props.template]);

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
        style={frameMinHeight != null ? { minHeight: frameMinHeight } : undefined}
      >
        <div
          className="shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-sm overflow-hidden"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            // Width hint so flex centering works at every scale tier.
            width: "210mm",
          }}
          ref={innerRef}
        >
          <ClassicTemplate {...templateProps} today={todayIso} />
        </div>
      </div>
    </div>
  );
}

export default ResumePreview;
