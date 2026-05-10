"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FileText, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TailoredResumeListItem } from "@/lib/tailored-resume-api";
import { DeleteResumeDialog } from "./delete-resume-dialog";

// ---------------------------------------------------------------------------
// Helpers (kept colocated; reused only by ResumeCard)
// ---------------------------------------------------------------------------

/**
 * Tailwind classes for the score badge by tier (TAILOR-15 §2.3).
 *   ≥80  → green (strong match)
 *   60–79 → amber (decent)
 *   <60   → muted gray (intentionally NOT red — the resume isn't broken).
 */
function scoreClasses(score: number): string {
  if (score >= 80)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (score >= 60)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        scoreClasses(score)
      )}
    >
      {score}%
    </span>
  );
}

function RatingStars({ value }: { value: number }) {
  const t = useTranslations("Resumes.editor.rating");
  const v = Math.min(Math.max(value, 1), 5);
  return (
    <span className="flex gap-0.5" aria-label={t("starsAria", { score: v })}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < v
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

/**
 * Date formatting per spec §2.5: relative for the first 7 days, absolute
 * thereafter. The 7-day cutoff matches the convention Linear uses — relative
 * deeper than ~a week ("47 days ago") is just noise.
 */
function makeFormatRelativeOrAbsolute(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return (iso: string): string => {
    const created = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - created;
    if (diffMs < 0) return t("createdJustNow");
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return t("createdJustNow");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("createdMinutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("createdHoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("createdDaysAgo", { count: days });
    const formatted = new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return t("createdAt", { date: formatted });
  };
}

/**
 * Subtitle decision tree (spec §2.4). The card name field is user-editable
 * and may diverge from the source job's title, so we always render the job
 * anchor underneath when available.
 */
function makeBuildSubtitle(
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return (jobCompany: string | null, jobTitle: string | null): string => {
    if (jobCompany && jobTitle)
      return t("tailoredFor", { company: jobCompany, title: jobTitle });
    if (jobCompany) return t("tailoredForCompanyOnly", { company: jobCompany });
    if (jobTitle) return t("tailoredForTitleOnly", { title: jobTitle });
    return t("tailoredFromProfile");
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ResumeCardProps {
  resume: TailoredResumeListItem;
  onDelete: (id: string) => void;
}

/**
 * Single tailored-resume card on the list page (TAILOR-15 §2).
 *
 * The whole card is a `<button>` that pushes to the editor. Trash sits
 * absolute top-right and stops propagation. Stars are pure presentation —
 * no click target. Hover reveals the trash via group-hover.
 *
 * We intentionally use a `<button>` outer (not a `<Link>`) because nesting
 * the trash button inside an anchor is invalid HTML, and we need both the
 * whole-card click target AND a separate destructive action. Trade-off:
 * loses `Cmd+Click → open in new tab`. Acceptable per spec §2.2.
 */
export function ResumeCard({ resume, onDelete }: ResumeCardProps) {
  const t = useTranslations("Resumes.list.card");
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buildSubtitle = makeBuildSubtitle(t);
  const formatRelativeOrAbsolute = makeFormatRelativeOrAbsolute(t);
  const subtitle = buildSubtitle(resume.job_company, resume.job_title);

  return (
    <>
      <button
        type="button"
        onClick={() => router.push(`/dashboard/resumes/${resume.id}`)}
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left",
          "transition-shadow hover:shadow-sm hover:border-border/60",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        )}
        aria-label={t("openAria", { name: resume.name })}
      >
        {/* Top: icon + name + trash */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              title={resume.name}
              className="line-clamp-2 text-sm font-semibold leading-snug"
            >
              {resume.name}
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
            aria-label={t("deleteAria")}
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

        {/* Middle: match score + rating */}
        <div className="flex items-center justify-between gap-3 pl-[52px]">
          <ScoreBadge score={resume.match_score} />
          {resume.rating != null && resume.rating > 0 ? (
            <RatingStars value={resume.rating} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Bottom: date */}
        <p className="pl-[52px] text-xs text-muted-foreground">
          {formatRelativeOrAbsolute(resume.created_at)}
        </p>
      </button>

      <DeleteResumeDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        resumeName={resume.name}
        hasRating={resume.rating != null && resume.rating > 0}
        onConfirm={() => onDelete(resume.id)}
      />
    </>
  );
}
