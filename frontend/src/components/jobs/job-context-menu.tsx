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
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

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
  tailored_resume: { id: string } | null;
  cover_letters: { id: string }[];
}

interface JobContextMenuProps {
  job: JobContextMenuJob;
  trigger: ReactNode;
  onDelete: (jobId: string) => void;
}

// ---------------------------------------------------------------------------
// JobContextMenu (TAILOR-16: Tailor Resume vs View Resume)
// ---------------------------------------------------------------------------

export function JobContextMenu({
  job,
  trigger,
  onDelete,
}: JobContextMenuProps) {
  const router = useRouter();
  const tMenu = useTranslations("Jobs.contextMenu");
  const tDel = useTranslations("Jobs.details.delete");
  const tCommon = useTranslations("Common");

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Detection is now synchronous from the JobResponse fields populated by the
  // backend (one-to-one tailored_resume, plus cover_letters list).
  const tailoredResumeId = job.tailored_resume?.id ?? null;
  const coverLetterId = job.cover_letters?.[0]?.id ?? null;

  const confirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await api.delete(`/api/v1/jobs/${job.id}`);
      if (!res.ok) throw new Error();
      setDeleteOpen(false);
      onDelete(job.id);
    } catch {
      setDeleteError(tDel("errorToast"));
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
            {tMenu("view")}
          </DropdownMenuItem>

          {/* Edit Job */}
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/jobs/${job.id}`)}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            {tMenu("edit")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Resume action — Tailor vs View based on job.tailored_resume
              (one-to-one). Synchronous from the job prop; no extra query. */}
          {tailoredResumeId ? (
            <DropdownMenuItem
              onSelect={() => router.push(`/dashboard/resumes/${tailoredResumeId}`)}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {tMenu("viewResume")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/dashboard/resumes/tailor?job_id=${job.id}`)
              }
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {tMenu("tailorResume")}
            </DropdownMenuItem>
          )}

          {/* Cover letter action — Generate vs View based on
              job.cover_letters[0]. The wizard expects `?job_id=` (not `?job=`). */}
          {coverLetterId === null ? (
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/dashboard/cover-letters/generate?job_id=${job.id}`)
              }
            >
              <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
              {tMenu("generateCoverLetter")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/dashboard/cover-letters/${coverLetterId}`)
              }
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {tMenu("viewCoverLetter")}
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
            {tMenu("delete")}
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
            <DialogTitle>{tDel("title")}</DialogTitle>
            <DialogDescription>
              {tDel("body", { title: job.title })}
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
              {tCommon("actions.cancel")}
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tCommon("states.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {tCommon("actions.delete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
