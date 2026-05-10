"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as Select from "@radix-ui/react-select";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Application {
  id: string;
  status: string;
  date_applied: string | null;
  deadline: string | null;
  follow_up_date: string | null;
  excitement_level: number | null;
  notes: string | null;
  resume_id: string | null;
  cover_letter_id: string | null;
}

interface JobResumeInfo {
  id: string;
  name: string;
  match_score?: number | null;
  updated_at: string;
}

interface JobCoverLetterInfo {
  id: string;
  name: string;
  updated_at: string;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  description_raw: string | null;
  requirements: string[];
  is_ai_parsed: boolean;
  created_at: string;
  application: Application;
  tailored_resume: JobResumeInfo | null;
  cover_letters: JobCoverLetterInfo[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

type Status = (typeof STATUSES)[number];

const STATUS_COLORS: Record<Status, { badge: string; dot: string }> = {
  saved: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  applied: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  screening: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  interview: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  offer: {
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
  },
  accepted: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-600",
  },
  rejected: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  withdrawn: {
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Save state indicator
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  state: SaveState;
  error?: string | null;
}

function SaveIndicator({ state, error }: SaveIndicatorProps) {
  if (state === "idle") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        state === "saving" && "text-muted-foreground",
        state === "saved" && "text-emerald-600 dark:text-emerald-400",
        state === "error" && "text-destructive"
      )}
    >
      {state === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3" />
          Saved
        </>
      )}
      {state === "error" && (
        <>
          <X className="h-3 w-3" />
          {error ?? "Failed to save"}
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline editable text field
// ---------------------------------------------------------------------------

interface InlineFieldProps {
  value: string;
  placeholder?: string;
  onSave: (val: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  as?: "input" | "textarea";
  rows?: number;
}

function InlineField({
  value,
  placeholder = "Click to edit...",
  onSave,
  className,
  inputClassName,
  as = "input",
  rows = 4,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    // Focus on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await onSave(trimmed);
      setSaveState("saved");
      setEditing(false);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function cancelEdit() {
    setDraft(value);
    setEditing(false);
    setSaveState("idle");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (as === "input" && e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  const sharedInputClass = cn(
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    inputClassName
  );

  return (
    <div className={cn("group relative", className)}>
      {editing ? (
        <div className="space-y-1.5">
          {as === "textarea" ? (
            <textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              rows={rows}
              className={cn(sharedInputClass, "resize-y")}
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className={sharedInputClass}
            />
          )}
          <SaveIndicator state={saveState} error={saveError} />
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <span
            onClick={startEdit}
            className={cn(
              "cursor-text rounded px-1 -mx-1 text-sm transition-colors hover:bg-muted/60",
              !value && "text-muted-foreground italic",
              className
            )}
          >
            {value || placeholder}
          </span>
          <button
            type="button"
            onClick={startEdit}
            className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label="Edit field"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {saveState !== "idle" && (
            <SaveIndicator state={saveState} error={saveError} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------

interface StarRatingProps {
  value: number | null;
  onChange: (val: number) => Promise<void>;
}

function StarRating({ value, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleClick(star: number) {
    setSaveState("saving");
    try {
      await onChange(star);
      setSaveState("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  const activeLevel = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const starNum = i + 1;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Set excitement to ${starNum}`}
              onClick={() => handleClick(starNum)}
              onMouseEnter={() => setHovered(starNum)}
              onMouseLeave={() => setHovered(null)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  starNum <= activeLevel
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-muted-foreground/40 hover:text-amber-300"
                )}
              />
            </button>
          );
        })}
      </div>
      <SaveIndicator state={saveState} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status select
// ---------------------------------------------------------------------------

interface StatusSelectProps {
  applicationId: string;
  value: string;
  onChange: (status: string) => void;
}

function StatusSelect({ applicationId, value, onChange }: StatusSelectProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStatus = STATUSES.includes(value as Status) ? (value as Status) : "saved";
  const colors = STATUS_COLORS[currentStatus];

  async function handleChange(newStatus: string) {
    setSaveState("saving");
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChange(newStatus);
      setSaveState("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select.Root value={value} onValueChange={handleChange}>
        <Select.Trigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "transition-opacity hover:opacity-80 cursor-pointer",
            colors.badge
          )}
          aria-label="Application status"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
          <Select.Value />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover shadow-md"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {STATUSES.map((s) => {
                const sc = STATUS_COLORS[s];
                return (
                  <Select.Item
                    key={s}
                    value={s}
                    className="flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    <span className={cn("h-2 w-2 rounded-full", sc.dot)} />
                    <Select.ItemText>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check className="h-3.5 w-3.5" />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      <SaveIndicator state={saveState} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date field — always visible, auto-save on change
// ---------------------------------------------------------------------------

interface DateFieldProps {
  value: string | null;
  label: string;
  onSave: (val: string | null) => Promise<void>;
}

function DateField({ value, label, onSave }: DateFieldProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value || null;
    setSaveState("saving");
    try {
      await onSave(newVal);
      setSaveState("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </label>
        <SaveIndicator state={saveState} />
      </div>
      <input
        type="date"
        defaultValue={value ?? ""}
        onChange={handleChange}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "text-foreground"
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes textarea — auto-save on blur
// ---------------------------------------------------------------------------

interface NotesFieldProps {
  value: string | null;
  onSave: (val: string | null) => Promise<void>;
}

function NotesField({ value, onSave }: NotesFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  async function handleBlur() {
    const trimmed = draft.trim() || null;
    if (trimmed === (value?.trim() || null)) return;
    setSaveState("saving");
    try {
      await onSave(trimmed);
      setSaveState("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Notes
        </label>
        <SaveIndicator state={saveState} />
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="Add notes about this application..."
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "resize-y min-h-[80px]"
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
  jobTitle: string;
}

function DeleteModal({ open, onOpenChange, onConfirm, isDeleting, jobTitle }: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 mb-2">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle>Delete Job?</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">&ldquo;{jobTitle}&rdquo;</span> and all
            associated data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
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
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 animate-pulse">
      {/* Back button */}
      <div className="h-4 w-16 rounded bg-muted-foreground/20" />
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-muted-foreground/20" />
        <div className="h-4 w-40 rounded bg-muted-foreground/15" />
        <div className="h-6 w-20 rounded-full bg-muted-foreground/15" />
      </div>
      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-40 rounded-xl bg-muted-foreground/10" />
          <div className="h-32 rounded-xl bg-muted-foreground/10" />
        </div>
        <div className="space-y-4">
          <div className="h-64 rounded-xl bg-muted-foreground/10" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      {title && (
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch job on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/v1/jobs/${jobId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setJob(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(
            err.message?.includes("404")
              ? "Job not found."
              : "Failed to load job. Please refresh the page."
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // ---------------------------------------------------------------------------
  // Patch helpers
  // ---------------------------------------------------------------------------

  async function patchJob(body: Record<string, unknown>) {
    const res = await api.patch(`/api/v1/jobs/${jobId}`, body);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await res.json();
    setJob(updated);
  }

  async function patchApplication(body: Record<string, unknown>) {
    if (!job) return;
    const res = await api.patch(`/api/v1/applications/${job.application.id}`, body);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await res.json();
    // Merge updated application into job state
    setJob((prev) => prev ? { ...prev, application: { ...prev.application, ...updated } } : prev);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/dashboard/jobs");
    } catch {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) return <PageSkeleton />;

  if (fetchError || !job) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </Link>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-lg font-medium">{fetchError ?? "Job not found."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted or you may not have access.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push("/dashboard/jobs")}
          >
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const { application } = job;
  const currentStatus = STATUSES.includes(job.application.status as Status)
    ? (job.application.status as Status)
    : "saved";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-12">
      {/* Back navigation */}
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Link>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          {/* Title — inline editable */}
          <InlineField
            value={job.title}
            placeholder="Job title"
            className="text-2xl font-bold tracking-tight"
            inputClassName="text-2xl font-bold h-auto py-1"
            onSave={(val) => patchJob({ title: val })}
          />
          {/* Company — inline editable */}
          <InlineField
            value={job.company}
            placeholder="Company name"
            className="text-base text-muted-foreground"
            onSave={(val) => patchJob({ company: val })}
          />
          {/* Status badge */}
          <StatusSelect
            applicationId={application.id}
            value={currentStatus}
            onChange={(newStatus) =>
              setJob((prev) =>
                prev
                  ? { ...prev, application: { ...prev.application, status: newStatus } }
                  : prev
              )
            }
          />
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => setDeleteModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          aria-label="Delete job"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 width */}
        <div className="space-y-5 lg:col-span-2">
          {/* Job details card */}
          <SectionCard title="Job Details">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Location */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <MapPin className="h-3 w-3" />
                  Location
                </label>
                <InlineField
                  value={job.location ?? ""}
                  placeholder="Add location..."
                  onSave={(val) => patchJob({ location: val || null })}
                />
              </div>

              {/* Salary */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Salary Range
                </label>
                <InlineField
                  value={job.salary ?? ""}
                  placeholder="Add salary range..."
                  onSave={(val) => patchJob({ salary: val || null })}
                />
              </div>
            </div>
          </SectionCard>

          {/* Job Description */}
          <SectionCard title="Job Description">
            <InlineField
              value={job.description_raw ?? ""}
              placeholder="No description added. Click to add one..."
              as="textarea"
              rows={8}
              onSave={(val) => patchJob({ description_raw: val || null })}
            />
          </SectionCard>

          {/* Requirements */}
          {job.requirements.length > 0 && (
            <SectionCard title="Requirements">
              <div className="flex flex-wrap gap-2">
                {job.requirements.map((req, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-5">
          {/* Application tracking card */}
          <SectionCard title="Application Tracking">
            <div className="space-y-4">
              {/* Date Applied */}
              <DateField
                label="Date Applied"
                value={application.date_applied}
                onSave={(val) => patchApplication({ date_applied: val })}
              />

              {/* Deadline */}
              <DateField
                label="Deadline"
                value={application.deadline}
                onSave={(val) => patchApplication({ deadline: val })}
              />

              {/* Follow-up Date */}
              <DateField
                label="Follow-up Date"
                value={application.follow_up_date}
                onSave={(val) => patchApplication({ follow_up_date: val })}
              />

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Excitement level */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Excitement Level
                </label>
                <StarRating
                  value={application.excitement_level}
                  onChange={(val) => patchApplication({ excitement_level: val })}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Notes */}
              <NotesField
                value={application.notes}
                onSave={(val) => patchApplication({ notes: val })}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Documents section */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h3>
        {(() => {
          const latestResume = job.tailored_resume ?? null;
          const latestCoverLetter = job.cover_letters?.[0];
          return (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Resume card */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Resume</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {latestResume ? "Resume ready" : "No resume tailored yet"}
                    </p>
                  </div>
                </div>
                {latestResume ? (
                  <Link href={`/dashboard/resumes/${latestResume.id}`}>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/dashboard/resumes/tailor?job_id=${job.id}`}>
                    <Button size="sm" className="shrink-0">
                      Tailor Resume
                    </Button>
                  </Link>
                )}
              </div>

              {/* Cover letter card */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cover Letter</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {latestCoverLetter ? "Cover letter ready" : "No cover letter yet"}
                    </p>
                  </div>
                </div>
                {latestCoverLetter ? (
                  <Link href={`/dashboard/cover-letters/${latestCoverLetter.id}`}>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                ) : (
                  // CL-11: wizard pre-fills via `?job_id=` — the older `?job=`
                  // here was silently ignored, dropping the user into a fresh
                  // wizard with no job selected.
                  <Link href={`/dashboard/cover-letters/generate?job_id=${job.id}`}>
                    <Button size="sm" className="shrink-0">
                      Generate
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Delete modal */}
      <DeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        jobTitle={job.title}
      />
    </div>
  );
}
