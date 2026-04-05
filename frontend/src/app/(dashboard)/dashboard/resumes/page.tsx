"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Star,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { listResumes, deleteResume, setBaseResume } from "@/lib/resume-api";
import type { ResumeListItem } from "@/types/resume";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 50) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

// ---------------------------------------------------------------------------
// Resume card skeleton
// ---------------------------------------------------------------------------

function ResumeCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted-foreground/10 shrink-0" />
        <div className="flex flex-col gap-2 mt-0.5 flex-1">
          <div className="h-4 w-40 rounded bg-muted-foreground/10" />
          <div className="h-3 w-24 rounded bg-muted-foreground/10" />
          <div className="flex gap-1.5 mt-0.5">
            <div className="h-4 w-10 rounded-full bg-muted-foreground/10" />
            <div className="h-4 w-14 rounded-full bg-muted-foreground/10" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-7 w-16 rounded-md bg-muted-foreground/10" />
        <div className="h-7 w-24 rounded-md bg-muted-foreground/10" />
        <div className="h-7 w-16 rounded-md bg-muted-foreground/10" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume card
// ---------------------------------------------------------------------------

interface ResumeCardProps {
  resume: ResumeListItem;
  onDelete: (id: string) => void;
  onSetBase: (id: string) => void;
  isSettingBase: boolean;
}

function ResumeCard({ resume, onDelete, onSetBase, isSettingBase }: ResumeCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
        {/* Top: icon + info */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-sm">{resume.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {resume.job_id ? "Tailored resume" : "General resume"} &middot;{" "}
              {formatDate(resume.created_at)}
            </p>
            {/* Badges */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {resume.is_base && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Base
                </span>
              )}
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {resume.original_file_format}
              </span>
              {resume.match_score !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    getScoreColor(resume.match_score)
                  )}
                >
                  {resume.match_score}% match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5">
            <Link href={`/dashboard/resumes/${resume.id}`}>
              <Edit2 className="h-3 w-3" />
              Edit
            </Link>
          </Button>

          {!resume.is_base && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => onSetBase(resume.id)}
              disabled={isSettingBase}
            >
              <Star className="h-3 w-3" />
              Set as Base
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resume</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{resume.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(resume.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ResumesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resumes"],
    queryFn: listResumes,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.success("Resume deleted successfully.");
    },
    onError: () => {
      toast.error("Failed to delete resume. Please try again.");
    },
  });

  const setBaseMutation = useMutation({
    mutationFn: (id: string) => setBaseResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      toast.success("Base resume updated.");
    },
    onError: () => {
      toast.error("Failed to update base resume. Please try again.");
    },
  });

  const resumes = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Resumes</h1>
        <Button asChild className="gap-1.5">
          <Link href="/dashboard/resumes/tailor">
            <Plus className="h-4 w-4" />
            Tailor Resume
          </Link>
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResumeCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-destructive" />}
            title="Failed to load resumes"
            description="There was an error loading your resumes. Please refresh the page."
            action={{ label: "Refresh", onClick: () => window.location.reload() }}
          />
        </div>
      ) : resumes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No resumes yet"
            description="No resumes yet. Upload your first resume to get started."
            action={{ label: "Tailor Your First Resume", href: "/dashboard/resumes/tailor" }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onDelete={(id) => deleteMutation.mutate(id)}
              onSetBase={(id) => setBaseMutation.mutate(id)}
              isSettingBase={setBaseMutation.isPending}
            />
          ))}
        </div>
      )}

    </div>
  );
}
