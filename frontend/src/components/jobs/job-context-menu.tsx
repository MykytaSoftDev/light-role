"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Pencil,
  FileText,
  PenLine,
  Mail,
  Trash2,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getTailoredResumeForJob } from "@/lib/tailored-resume-api";
import { queryKeys } from "@/hooks/api/keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobContextMenuJob {
  id: string;
  title: string;
  application: {
    id: string;
    resume_id: string | null;
    cover_letter_id: string | null;
  };
}

interface JobContextMenuProps {
  job: JobContextMenuJob;
  trigger: ReactNode;
  onDelete: (jobId: string) => void;
  /**
   * When true (default), the tailored-resume lookup is gated on `menuOpen`
   * so the Jobs list page (which can render dozens of rows) doesn't stampede
   * the API. Set to `false` on single-instance surfaces like the job detail
   * page where eager fetch is fine.
   */
  lazyTailoredResume?: boolean;
}

// ---------------------------------------------------------------------------
// JobContextMenu (TAILOR-16: Tailor Resume vs View Resume)
// ---------------------------------------------------------------------------

export function JobContextMenu({
  job,
  trigger,
  onDelete,
  lazyTailoredResume = true,
}: JobContextMenuProps) {
  const router = useRouter();
  const { application } = job;

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // GET /api/v1/jobs/{id}/tailored-resume — 200 → exists, 204 → null. Lazy by
  // default so the Jobs list page only fires per-row when the menu opens.
  // Per-job query key so React Query caches each row independently.
  const tailoredResumeQuery = useQuery({
    queryKey: [...queryKeys.jobs.detail(job.id), "tailored-resume"] as const,
    queryFn: () => getTailoredResumeForJob(job.id),
    enabled: lazyTailoredResume ? menuOpen : true,
    staleTime: 1000 * 60 * 2,
  });

  const tailoredResumeId = tailoredResumeQuery.data?.id ?? null;
  const tailoredResumeChecking = tailoredResumeQuery.isLoading;

  const confirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await api.delete(`/api/v1/jobs/${job.id}`);
      if (!res.ok) throw new Error();
      setDeleteOpen(false);
      onDelete(job.id);
    } catch {
      setDeleteError("Failed to delete job. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

        <DropdownMenuContent
          className="min-w-[188px]"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          {/* View Details */}
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/jobs/${job.id}`)}>
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            View Details
          </DropdownMenuItem>

          {/* Edit Job */}
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/jobs/${job.id}`)}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Edit Job
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Resume action — Tailor vs View based on /jobs/{id}/tailored-resume.
              While the lookup is in flight (first menu open) we render the
              spinner-prefixed item rather than guess; clicking it is a no-op. */}
          {tailoredResumeChecking && tailoredResumeId === null ? (
            <DropdownMenuItem
              disabled
              onSelect={(e) => e.preventDefault()}
              className="opacity-70"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              Checking resume…
            </DropdownMenuItem>
          ) : tailoredResumeId ? (
            <DropdownMenuItem
              onSelect={() => router.push(`/dashboard/resumes/${tailoredResumeId}`)}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              View Resume
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/dashboard/resumes/tailor?job_id=${job.id}`)
              }
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Tailor Resume
            </DropdownMenuItem>
          )}

          {/* Cover letter action — unchanged from existing impl. Cover letter
              has its own existence model via application.cover_letter_id. */}
          {application.cover_letter_id === null ? (
            <DropdownMenuItem
              onSelect={() => router.push(`/dashboard/cover-letters/generate?job=${job.id}`)}
            >
              <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
              Generate Cover Letter
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/dashboard/cover-letters/${application.cover_letter_id}`)
              }
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              View Cover Letter
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete — prevent dropdown from closing so the Dialog can open */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
            className="text-red-500 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation — rendered outside DropdownMenu so it persists after menu closes */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteOpen(open);
            if (!open) setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete Job?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{job.title}&rdquo;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setDeleteOpen(false);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
