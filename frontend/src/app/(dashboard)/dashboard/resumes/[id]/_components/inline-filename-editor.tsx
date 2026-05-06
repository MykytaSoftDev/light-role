"use client";

/**
 * TAILOR-8 — Inline filename editor.
 *
 * Click the title (or pencil) → switches to an Input. Enter or blur saves
 * via PATCH; Esc cancels. While the mutation is in-flight, the input is
 * disabled and a spinner replaces the pencil.
 *
 * Backend reality: PATCH /api/v1/tailored-resumes/{id} is not implemented
 * yet (see tailored-resume-api.ts). The save still fires, fails with a
 * `NOT_IMPLEMENTED` TailorError, and we revert + toast — no crash.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.5.
 */
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/hooks/api/keys";
import {
  patchTailoredResume,
  TailorError,
  type TailoredResume,
} from "@/lib/tailored-resume-api";

interface InlineFilenameEditorProps {
  resumeId: string;
  initialName: string;
}

export function InlineFilenameEditor({
  resumeId,
  initialName,
}: InlineFilenameEditorProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initialName);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);

  // Keep the local draft synced when the upstream resume name changes
  // (e.g. cache update from another tab).
  React.useEffect(() => {
    if (!isEditing) setDraft(initialName);
  }, [initialName, isEditing]);

  const renameMutation = useMutation<
    TailoredResume,
    TailorError,
    { name: string }
  >({
    mutationFn: ({ name }) => patchTailoredResume(resumeId, { name }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.resumes.detail(resumeId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.lists() });
      toast.success("Resume renamed.");
      setIsEditing(false);
      // Restore focus to the (now display-mode) heading per spec §3.12.
      setTimeout(() => headingRef.current?.focus(), 0);
    },
    onError: (err) => {
      const message =
        err.code === "NOT_IMPLEMENTED"
          ? "Renaming isn't available yet — backend endpoint pending."
          : "Couldn't rename. Try again.";
      toast.error(message);
      setDraft(initialName);
      setIsEditing(false);
    },
  });

  function startEdit() {
    setDraft(initialName);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === initialName) {
      setIsEditing(false);
      setDraft(initialName);
      return;
    }
    renameMutation.mutate({ name: trimmed });
  }

  function cancel() {
    setDraft(initialName);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          disabled={renameMutation.isPending}
          aria-label="Resume name"
          className="h-auto py-1 px-2 text-2xl font-semibold tracking-tight"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
        {renameMutation.isPending ? (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Save name"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commit}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Cancel rename"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight focus:outline-none"
      >
        {initialName}
      </h1>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Rename resume"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={startEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
