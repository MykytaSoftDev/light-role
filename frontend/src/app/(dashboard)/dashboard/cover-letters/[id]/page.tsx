"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCoverLetter,
  updateCoverLetter,
  downloadCoverLetterPdf,
  downloadCoverLetterDocx,
  tiptapDocToPlainText,
  plainTextToTiptapDoc,
  CoverLetterFetchError,
} from "@/lib/cover-letter-api";
import type { CLStyle, CLTone, CLLength } from "@/types/cover-letter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatTone(tone: CLTone): string {
  switch (tone) {
    case "confident":
      return "Confident";
    case "humble":
      return "Humble";
    case "enthusiastic":
      return "Enthusiastic";
  }
}

function formatLength(length: CLLength): string {
  switch (length) {
    case "short":
      return "Short";
    case "medium":
      return "Medium";
    case "long":
      return "Long";
  }
}

// ---------------------------------------------------------------------------
// Auto-resizing textarea hook
// ---------------------------------------------------------------------------

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return ref;
}

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs transition-opacity",
        status === "saved" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
      )}
    >
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "saved" && <Check className="h-3 w-3" />}
      {status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
      <span>
        {status === "saving" && "Saving..."}
        {status === "saved" && "Saved"}
        {status === "error" && "Save failed"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor panel
// ---------------------------------------------------------------------------

interface EditorPanelProps {
  name: string;
  content: string;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  saveStatus: SaveStatus;
  onNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  isExporting: boolean;
}

function EditorPanel({
  name,
  content,
  style,
  tone,
  length,
  saveStatus,
  onNameChange,
  onContentChange,
  onExportPdf,
  onExportDocx,
  isExporting,
}: EditorPanelProps) {
  const textareaRef = useAutoResize(content);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Name input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Cover Letter Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          placeholder="Cover letter name..."
        />
      </div>

      {/* Settings display — read-only per PRD §6.6 (immutable after wizard). */}
      <div
        className="flex flex-wrap gap-2"
        aria-label="Generation settings (read-only)"
      >
        <Badge variant="secondary" className="font-medium">
          Style: {formatStyle(style)}
        </Badge>
        <Badge variant="secondary" className="font-medium">
          Tone: {formatTone(tone)}
        </Badge>
        <Badge variant="secondary" className="font-medium">
          Length: {formatLength(length)}
        </Badge>
      </div>

      {/* Content textarea */}
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Content
          </label>
          <SaveIndicator status={saveStatus} />
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className={cn(
            "w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "resize-none overflow-hidden leading-relaxed"
          )}
          placeholder="Your cover letter content..."
        />
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onExportPdf}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onExportDocx}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export DOCX
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

function PreviewPanel({ name, content }: { name: string; content: string }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="rounded-xl border border-border bg-white dark:bg-zinc-900 shadow-sm p-8 min-h-[600px]">
        {/* Document header area */}
        <div className="mb-6 pb-4 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">{name || "Cover Letter"}</h2>
        </div>
        {/* Content */}
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {content || (
            <span className="text-muted-foreground italic">
              Start typing your cover letter in the editor...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab view
// ---------------------------------------------------------------------------

type MobileTab = "edit" | "preview";

function MobileTabView({
  name,
  content,
  editorProps,
}: {
  name: string;
  content: string;
  editorProps: EditorPanelProps;
}) {
  const [activeTab, setActiveTab] = useState<MobileTab>("edit");
  return (
    <div>
      <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 mb-4">
        {(["edit", "preview"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>
      {activeTab === "edit" ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <EditorPanel {...editorProps} />
        </div>
      ) : (
        <PreviewPanel name={name} content={content} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor page
// ---------------------------------------------------------------------------

export default function CoverLetterEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  // Editor state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = useRef(false);

  // Fetch cover letter. We expose `error` so the render branch can show a
  // friendly "not found" message specifically on 404 (vs a generic failure).
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cover-letter", id],
    queryFn: () => getCoverLetter(id),
    retry: (failureCount, err) => {
      // Don't retry 404s — they won't change.
      if (err instanceof CoverLetterFetchError && err.status === 404) return false;
      return failureCount < 2;
    },
  });

  // Initialize editor content from fetched data.
  //
  // CL-8 data adapter: backend serves `content` as a Tiptap JSON document
  // (per v2.1 schema). The textarea wants plain text, so we flatten on read
  // and re-wrap on write — see `tiptapDocToPlainText` / `plainTextToTiptapDoc`
  // in `lib/cover-letter-api.ts` for the round-trip contract.
  useEffect(() => {
    if (data && !isInitialized.current) {
      setName(data.name);
      setContent(tiptapDocToPlainText(data.content));
      isInitialized.current = true;
    }
  }, [data]);

  // Auto-save mutation. The wire shape sends `content` as Tiptap JSON; the
  // editor only ever speaks plain text, so we wrap at the call site below.
  const saveMutation = useMutation({
    mutationFn: (updates: { name?: string; contentText?: string }) => {
      const payload: { name?: string; content?: ReturnType<typeof plainTextToTiptapDoc> } = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.contentText !== undefined) {
        payload.content = plainTextToTiptapDoc(updates.contentText);
      }
      return updateCoverLetter(id, payload);
    },
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["cover-letter", id] });
      queryClient.invalidateQueries({ queryKey: ["cover-letters"] });
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  // Debounced save trigger
  const triggerSave = useCallback(
    (updates: { name?: string; contentText?: string }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(updates);
      }, 1500);
    },
    [saveMutation]
  );

  const handleNameChange = (newName: string) => {
    setName(newName);
    // Only the changed field is sent — backend PATCH is partial.
    triggerSave({ name: newName });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    triggerSave({ contentText: newContent });
  };

  const handleExport = async (format: "pdf" | "docx") => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob =
        format === "pdf"
          ? await downloadCoverLetterPdf(id)
          : await downloadCoverLetterDocx(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cover-letter.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after the click stack settles so the navigation has a chance
      // to consume the URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(`Failed to export as ${format.toUpperCase()}. Please try again.`);
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-4 w-32 rounded bg-muted-foreground/10 animate-pulse" />
        <div className="h-8 w-64 rounded bg-muted-foreground/10 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />
          <div className="h-96 rounded-xl border border-border bg-muted/30 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const isNotFound =
      error instanceof CoverLetterFetchError && error.status === 404;
    return (
      <div className="flex flex-col gap-6 p-6">
        <Link
          href="/dashboard/cover-letters"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Cover Letters
        </Link>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-5 py-4 text-sm",
            isNotFound
              ? "border border-border bg-muted/30 text-foreground"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          <AlertCircle
            className={cn(
              "h-5 w-5 shrink-0",
              isNotFound ? "text-muted-foreground" : ""
            )}
          />
          <div>
            <p className="font-semibold">
              {isNotFound
                ? "Cover letter not found"
                : "Failed to load cover letter"}
            </p>
            <p
              className={cn(
                "mt-0.5",
                isNotFound ? "text-muted-foreground" : "text-destructive/80"
              )}
            >
              {isNotFound
                ? "This cover letter may have been deleted, or the link is incorrect."
                : "There was an error loading this cover letter. Please go back and try again."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CL-8: backend now exposes the API field as `length` (aliased from the
  // legacy DB column `length_setting` via the Pydantic alias). The legacy
  // field name is gone from the response shape.
  const editorProps = {
    name,
    content,
    style: data.style,
    tone: data.tone,
    length: data.length,
    saveStatus,
    onNameChange: handleNameChange,
    onContentChange: handleContentChange,
    onExportPdf: () => handleExport("pdf"),
    onExportDocx: () => handleExport("docx"),
    isExporting,
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/cover-letters"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Cover Letters
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight truncate">{name || "Cover Letter"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Changes are saved automatically.
        </p>
      </div>

      {/* Export error toast */}
      {exportError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {exportError}
        </div>
      )}

      {/* Desktop: two-column layout */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
        {/* Left: Editor */}
        <div className="rounded-xl border border-border bg-card p-5">
          <EditorPanel {...editorProps} />
        </div>

        {/* Right: Preview */}
        <div>
          <div className="sticky top-6">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Live Preview
            </p>
            <PreviewPanel name={name} content={content} />
          </div>
        </div>
      </div>

      {/* Mobile: tab-based layout */}
      <div className="lg:hidden">
        <MobileTabView name={name} content={content} editorProps={editorProps} />
      </div>
    </div>
  );
}
