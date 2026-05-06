"use client";

/**
 * TAILOR-8 — Preview frame.
 *
 * Hairline-bordered container hosting the existing `<ResumePreview>`. The
 * top edge is `relative` so TAILOR-9 can mount its Edit button absolutely
 * and have it visually interrupt the border.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.7.
 */
import * as React from "react";

interface PreviewFrameProps {
  children: React.ReactNode;
}

export function PreviewFrame({ children }: PreviewFrameProps) {
  return (
    <div
      role="region"
      aria-label="Resume preview"
      className="relative rounded-md border border-border bg-card overflow-hidden"
    >
      {/*
        TAILOR-9: Edit button mounts here.
        Position: absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
        Size: h-9 px-5; variant: filled primary; shadow-sm; z-10
      */}
      {children}
    </div>
  );
}
