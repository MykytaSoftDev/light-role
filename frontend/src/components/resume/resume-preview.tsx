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
}

/** Pick the scale tier from a viewport width (spec §9 breakpoints). */
function scaleForWidth(width: number): number {
  if (width >= 1280) return 1.0;
  if (width >= 1024) return 0.9;
  if (width >= 768) return 0.75;
  return 0.5;
}

/**
 * useMatchMediaScale: subscribes to the four media-query tiers from spec §9
 * and returns the active scale factor. Defaults to 1.0 during SSR.
 */
function useMatchMediaScale(): number {
  const [scale, setScale] = React.useState<number>(1.0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setScale(scaleForWidth(window.innerWidth));
    update();
    // Listen on the three breakpoint boundaries.
    const queries = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(min-width: 768px)"),
    ];
    for (const mq of queries) mq.addEventListener("change", update);
    return () => {
      for (const mq of queries) mq.removeEventListener("change", update);
    };
  }, []);

  return scale;
}

export function ResumePreview(props: ResumePreviewProps) {
  const { scale: scaleOverride, className, today, ...templateProps } = props;
  const autoScale = useMatchMediaScale();
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
      className={
        "bg-gray-100 dark:bg-background p-8 flex justify-center " + (className ?? "")
      }
    >
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
