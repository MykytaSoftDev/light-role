"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  X,
} from "lucide-react";
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
import { listCoverLetters, deleteCoverLetter, exportCoverLetter } from "@/lib/cover-letter-api";
import { listJobs } from "@/lib/jobs-api";
import type { CoverLetterListItem, CLStyle } from "@/types/cover-letter";

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

function formatStyle(style: CLStyle): string {
  switch (style) {
    case "job_matched":
      return "Job Matched";
    case "formal":
      return "Formal";
    case "professional":
      return "Professional";
  }
}

function getStyleColor(style: CLStyle): string {
  switch (style) {
    case "job_matched":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "formal":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "professional":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastMessage {
  id: number;
  message: string;
  type: "success" | "error";
}

let toastCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (message: string, type: "success" | "error" = "error") => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, removeToast };
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg text-sm",
            t.type === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/70 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/70 dark:text-green-300"
          )}
        >
          {t.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{t.message}</span>
          <button onClick={() => onRemove(t.id)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CoverLetterCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted-foreground/10 shrink-0" />
        <div className="flex flex-col gap-2 mt-0.5 flex-1">
          <div className="h-4 w-40 rounded bg-muted-foreground/10" />
          <div className="h-3 w-24 rounded bg-muted-foreground/10" />
          <div className="flex gap-1.5 mt-0.5">
            <div className="h-4 w-20 rounded-full bg-muted-foreground/10" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-7 w-16 rounded-md bg-muted-foreground/10" />
        <div className="h-7 w-20 rounded-md bg-muted-foreground/10" />
        <div className="h-7 w-16 rounded-md bg-muted-foreground/10" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover letter card
// ---------------------------------------------------------------------------

interface CoverLetterCardProps {
  coverLetter: CoverLetterListItem;
  jobTitle: string | null;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  isExporting: boolean;
}

function CoverLetterCard({
  coverLetter,
  jobTitle,
  onDelete,
  onExport,
  isExporting,
}: CoverLetterCardProps) {
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
            <p className="truncate font-semibold text-sm">{coverLetter.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {jobTitle ? jobTitle : "No job linked"} &middot;{" "}
              {formatDate(coverLetter.created_at)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  getStyleColor(coverLetter.style)
                )}
              >
                {formatStyle(coverLetter.style)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5"
          >
            <Link href={`/dashboard/cover-letters/${coverLetter.id}`}>
              <Edit2 className="h-3 w-3" />
              Edit
            </Link>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={() => onExport(coverLetter.id)}
            disabled={isExporting}
          >
            <Download className="h-3 w-3" />
            PDF
          </Button>

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
            <DialogTitle>Delete Cover Letter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{coverLetter.name}&quot;? This
              action cannot be undone.
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
                onDelete(coverLetter.id);
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

export default function CoverLettersPage() {
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["cover-letters"],
    queryFn: () => listCoverLetters(),
  });

  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCoverLetter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cover-letters"] });
      addToast("Cover letter deleted successfully.", "success");
    },
    onError: () => {
      addToast("Failed to delete cover letter. Please try again.");
    },
  });

  const handleExport = async (id: string) => {
    setExportingId(id);
    try {
      await exportCoverLetter(id, "pdf");
    } catch {
      addToast("Failed to export cover letter. Please try again.");
    } finally {
      setExportingId(null);
    }
  };

  // Build a job id → title map for display
  const jobMap = new Map<string, string>();
  for (const job of jobsData?.items ?? []) {
    jobMap.set(job.id, `${job.title}${job.company ? ` — ${job.company}` : ""}`);
  }

  // Sort cover letters by newest first
  const coverLetters = [...(data?.items ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Cover Letters</h1>
        <Button asChild className="gap-1.5">
          <Link href="/dashboard/cover-letters/generate">
            <Plus className="h-4 w-4" />
            Generate New
          </Link>
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CoverLetterCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-destructive" />}
            title="Failed to load cover letters"
            description="There was an error loading your cover letters. Please refresh the page."
            action={{ label: "Refresh", onClick: () => window.location.reload() }}
          />
        </div>
      ) : coverLetters.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No cover letters yet"
            description="No cover letters yet. Generate your first cover letter to get started."
            action={{
              label: "Generate Cover Letter",
              href: "/dashboard/cover-letters/generate",
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coverLetters.map((cl) => (
            <CoverLetterCard
              key={cl.id}
              coverLetter={cl}
              jobTitle={cl.job_id ? (jobMap.get(cl.job_id) ?? null) : null}
              onDelete={(id) => deleteMutation.mutate(id)}
              onExport={handleExport}
              isExporting={exportingId === cl.id}
            />
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
