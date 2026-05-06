"use client";

/**
 * TAILOR-8 — Editor shell (client).
 *
 * Loads the TailoredResume, renders the breadcrumb / title / download chrome,
 * and embeds the existing `<ResumePreview>`. The Edit-button slot at the top
 * of the preview frame is reserved (empty) for TAILOR-9.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.
 */
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ResumePreview } from "@/components/resume/resume-preview";
import { queryKeys } from "@/hooks/api/keys";
import {
  getTailoredResume,
  TailorError,
  type TailoredResume,
} from "@/lib/tailored-resume-api";
import {
  RESUME_FONTS,
  type ResumeFont,
} from "@/lib/fonts/resume-fonts";

import { EditorShellSkeleton } from "./editor-shell-skeleton";
import { InlineFilenameEditor } from "./inline-filename-editor";
import { DownloadButton } from "./download-button";
import { InsightsPanelPlaceholder } from "./insights-panel-placeholder";
import { PreviewFrame } from "./preview-frame";

interface EditorShellProps {
  id: string;
}

export function EditorShell({ id }: EditorShellProps) {
  const query = useQuery<TailoredResume, TailorError>({
    queryKey: queryKeys.resumes.detail(id),
    queryFn: () => getTailoredResume(id),
    staleTime: 1000 * 60,
    retry: (failureCount, err) => {
      // Don't retry "not found" / "not implemented" — these are deterministic.
      if (err instanceof TailorError) {
        if (err.code === "JOB_NOT_FOUND" || err.code === "NOT_IMPLEMENTED") {
          return false;
        }
      }
      return failureCount < 1;
    },
  });

  if (query.isLoading) return <EditorShellSkeleton />;

  // Friendly 404 — covers both "row not found" and the (current) 404/405 from
  // the missing GET endpoint, so the editor degrades gracefully.
  if (query.isError) {
    return <NotFoundState />;
  }

  if (!query.data) {
    return <NotFoundState />;
  }

  return <EditorChrome resume={query.data} />;
}

// ---------------------------------------------------------------------------
// Chrome (header + body grid)
// ---------------------------------------------------------------------------

function EditorChrome({ resume }: { resume: TailoredResume }) {
  // TAILOR-8 backend gap: `TailoredResumeResponse` does not currently
  // include the joined Job — so we can't render
  // "Resume tailored for {company_name}" (spec §3.5) without a follow-up
  // fetch. Fall back to the spec's documented alternative until backend-dev
  // either adds a `job` relation to the response or we fetch the job
  // separately via `resume.job_id`.
  const subtitle = "Resume tailored from your profile";

  // Coerce font_snapshot to a known ResumeFont; fall back to Inter.
  const font: ResumeFont = (RESUME_FONTS as readonly string[]).includes(
    resume.font_snapshot
  )
    ? (resume.font_snapshot as ResumeFont)
    : "Inter";

  const sectionsOrder =
    resume.sections_order_snapshot && resume.sections_order_snapshot.length > 0
      ? resume.sections_order_snapshot
      : [
          "summary",
          "employment",
          "education",
          "skills",
          "languages",
          "projects",
          "certificates",
          "achievements",
          "volunteer",
        ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Resumes", href: "/dashboard/resumes" },
          {
            label:
              resume.name.length > 40
                ? resume.name.slice(0, 40) + "…"
                : resume.name,
          },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <InlineFilenameEditor
            resumeId={resume.id}
            initialName={resume.name}
          />
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <DownloadButton resumeId={resume.id} />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px]">
        <PreviewFrame>
          <ResumePreview
            data={resume.tailored_data}
            font={font}
            sections_order={sectionsOrder}
            template="classic"
          />
        </PreviewFrame>

        {/* Side panel: hidden on mobile, stacks on tablet, sticky on desktop. */}
        <div className="hidden md:block">
          <InsightsPanelPlaceholder />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 state
// ---------------------------------------------------------------------------

function NotFoundState() {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto max-w-md text-center py-16 space-y-4">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight focus:outline-none"
      >
        Resume not found
      </h1>
      <p className="text-sm text-muted-foreground">
        This resume doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/dashboard/resumes">Back to Resumes</Link>
      </Button>
    </div>
  );
}
