"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2, Sparkles, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CoverLetterListItem, CLStyle, CLTone, CLLength } from "@/types/cover-letter";
import { DeleteCoverLetterDialog } from "./delete-cover-letter-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map of job_id → minimal job metadata used to render the subtitle. */
export type JobLookup = Map<
  string,
  { title: string; company: string | null }
>;

interface CoverLetterCardProps {
  coverLetter: CoverLetterListItem;
  jobLookup: JobLookup;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers (kept colocated; reused only by CoverLetterCard)
// ---------------------------------------------------------------------------

/** Style → display label. Mirrors the wizard's labels (CL-4..CL-7). */
function formatStyle(style: CLStyle): string {
  switch (style) {
    case "job_matched":
      return "Job-Matched";
    case "formal":
      return "Formal";
    case "professional":
      return "Professional";
  }
}

function formatTone(tone: CLTone): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

function formatLength(length: CLLength): string {
  return length.charAt(0).toUpperCase() + length.slice(1);
}

/**
 * Date formatting per spec — relative for the first 7 days, absolute thereafter.
 * Mirrors the resume-card helper for consistency.
 */
function formatRelativeOrAbsolute(iso: string): string {
  const created = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - created;
  if (diffMs < 0) return "Created just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Created just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `Created ${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Created ${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Created ${days} day${days !== 1 ? "s" : ""} ago`;
  const formatted = new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Created ${formatted}`;
}

/**
 * Subtitle decision tree. The CL list endpoint doesn't join Job, so we may
 * legitimately have a job_id that points at a job not in our /jobs page (only
 * the first 100 are fetched for the lookup). In that case we fall back to a
 * generic "linked job" label rather than render an empty subtitle.
 */
function makeBuildSubtitle(t: (key: string) => string) {
  return (
    jobId: string | null,
    job: { title: string; company: string | null } | undefined
  ): string => {
    if (!jobId) return t("subtitleStandalone");
    if (!job) return t("subtitleLinkedFallback");
    if (job.company && job.title) return `${job.company} — ${job.title}`;
    return job.title || job.company || t("subtitleLinkedFallback");
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Single cover-letter card on the list page (CL-10).
 *
 * Whole card is a `<button>` that pushes to the editor at
 * `/dashboard/cover-letters/{id}`. Trash sits absolute top-right and stops
 * propagation. Style / Tone / Length render as small `<Badge>`s — they're
 * read-only here (the CL spec marks them as immutable post-finalisation).
 *
 * NOTE on "Generating…" badge slot (CL-12): Phase 4 spec mentions a
 * background-generation indicator. That state isn't surfaced by the list
 * endpoint today (no `is_generating` field). The slot lives in the badge
 * row — when CL-12 lands the backend can flag this, and the frontend just
 * adds another `<Badge variant="outline">Generating…</Badge>` here.
 */
export function CoverLetterCard({
  coverLetter,
  jobLookup,
  onDelete,
}: CoverLetterCardProps) {
  const router = useRouter();
  const tCard = useTranslations("coverLetters.list.card");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buildSubtitle = makeBuildSubtitle(tCard);
  const job = coverLetter.job_id ? jobLookup.get(coverLetter.job_id) : undefined;
  const subtitle = buildSubtitle(coverLetter.job_id, job);

  // Source-type indicator (PRD §3.6: "From Tailored Resume" / "From Profile").
  const sourceLabel =
    coverLetter.source_type === "tailored_resume"
      ? tCard("sourceFromTailoredResume")
      : tCard("sourceFromProfile");
  const SourceIcon = coverLetter.source_type === "tailored_resume" ? Sparkles : User;

  return (
    <>
      <button
        type="button"
        onClick={() => router.push(`/dashboard/cover-letters/${coverLetter.id}`)}
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left",
          "transition-shadow hover:shadow-sm hover:border-border/60",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        )}
        aria-label={tCard("openAria", { name: coverLetter.name })}
      >
        {/* Top: icon + name + trash */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              title={coverLetter.name}
              className="line-clamp-2 text-sm font-semibold leading-snug"
            >
              {coverLetter.name}
            </p>
            <p
              title={subtitle}
              className="mt-0.5 truncate text-xs text-muted-foreground"
            >
              {subtitle}
            </p>
          </div>
          <span
            role="button"
            tabIndex={0}
            aria-label={tCard("deleteAria")}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setConfirmDelete(true);
              }
            }}
            className={cn(
              "shrink-0 rounded-md p-1.5 text-muted-foreground cursor-pointer",
              "opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100",
              "hover:bg-destructive/10 hover:text-destructive focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <Trash2 className="h-4 w-4" />
          </span>
        </div>

        {/* Source-type indicator (PRD §3.6) */}
        <div className="pl-[52px]">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <SourceIcon className="h-3 w-3" />
            {sourceLabel}
          </span>
        </div>

        {/* Style / Tone / Length badges — read-only metadata.
            Future CL-12 "Generating…" badge would land here too. */}
        <div className="flex flex-wrap items-center gap-1.5 pl-[52px]">
          <Badge variant="outline" className="px-2 py-0 text-[10px] font-medium">
            {formatStyle(coverLetter.style)}
          </Badge>
          <Badge variant="outline" className="px-2 py-0 text-[10px] font-medium">
            {formatTone(coverLetter.tone)}
          </Badge>
          <Badge variant="outline" className="px-2 py-0 text-[10px] font-medium">
            {formatLength(coverLetter.length)}
          </Badge>
        </div>

        {/* Bottom: date */}
        <p className="pl-[52px] text-xs text-muted-foreground">
          {formatRelativeOrAbsolute(coverLetter.created_at)}
        </p>
      </button>

      <DeleteCoverLetterDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        coverLetterName={coverLetter.name}
        onConfirm={() => onDelete(coverLetter.id)}
      />
    </>
  );
}
