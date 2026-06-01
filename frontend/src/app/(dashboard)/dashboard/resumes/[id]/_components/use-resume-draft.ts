"use client";

/**
 * TAILOR-9 — Resume Edit-mode draft state machine.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §1.
 *
 * Responsibilities:
 *   1. Hold Preview/Edit mode flag.
 *   2. Hold the immutable snapshot (taken on Edit entry) and the live draft
 *      (deep-cloned from snapshot, mutated by section editors / toolbar).
 *   3. Compute `isDirty` via stable-stringify diff.
 *   4. Provide `enterEdit`, `cancelEdit`, `forceCancelEdit`, `saveEdit`, and
 *      granular setters used by toolbar + Pass-2 section editors.
 *   5. Wire navigation guards: `beforeunload` (browser tab close / refresh)
 *      and document-level capture-phase click intercept on anchors (Next.js
 *      <Link> + sidebar nav). Internal app navigation that does NOT change
 *      the route (in-page modals) is NOT guarded.
 *
 * Filename rename is INTENTIONALLY NOT routed through this hook — see
 * inline-filename-editor.tsx; it commits `name` immediately via PATCH.
 * Reason: filename is metadata, not editable content. Treating it as a
 * draft field would force "rename then Cancel reverts the rename" — a bug.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ProfileData } from "@/lib/profile-api";
import { queryKeys } from "@/hooks/api/keys";
import {
  patchTailoredResume,
  TailorError,
  type TailoredResume,
  type TailoredResumePatchRequest,
} from "@/lib/tailored-resume-api";
import {
  isDraftDirty,
  type EditableSnapshot,
} from "@/lib/resume/is-draft-dirty";
import { sanitizeTailoredData } from "@/lib/resume/sanitize-tailored-data";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EditorMode = "preview" | "edit";

export interface UseResumeDraftReturn {
  mode: EditorMode;
  draft: EditableSnapshot;
  snapshot: EditableSnapshot;
  isDirty: boolean;
  isSaving: boolean;
  enterEdit: () => void;
  cancelEdit: () => void;
  forceCancelEdit: () => void;
  saveEdit: () => Promise<void>;
  setDraftFont: (font: string) => void;
  setDraftSectionsOrder: (order: string[]) => void;
  /** Used by section editors in Pass 2 (TAILOR-10). */
  setDraftTailoredData: (data: ProfileData) => void;

  // Discard-dialog wiring — page-level shell mounts a single
  // <DiscardChangesDialog> driven by these.
  discardDialogOpen: boolean;
  setDiscardDialogOpen: (open: boolean) => void;
  /** Called by the dialog on confirm. */
  confirmDiscard: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshotFromResume(resume: TailoredResume): EditableSnapshot {
  return {
    tailored_data: structuredClone(resume.tailored_data),
    sections_order_snapshot: [...resume.sections_order_snapshot],
    font_snapshot: resume.font_snapshot,
  };
}

function buildPatchBody(
  draft: EditableSnapshot,
  snapshot: EditableSnapshot
): TailoredResumePatchRequest {
  const body: TailoredResumePatchRequest = {};
  // Reuse the dirty helper's stable-stringify to diff each surface.
  // Cheaper than stringifying the whole structure twice — but correctness
  // matters more than micro-optimization here, so just compare the three
  // pieces individually.
  const draftDataStr = JSON.stringify(draft.tailored_data);
  const snapDataStr = JSON.stringify(snapshot.tailored_data);
  if (draftDataStr !== snapDataStr) {
    body.tailored_data = draft.tailored_data;
  }
  if (
    JSON.stringify(draft.sections_order_snapshot) !==
    JSON.stringify(snapshot.sections_order_snapshot)
  ) {
    body.sections_order_snapshot = draft.sections_order_snapshot;
  }
  if (draft.font_snapshot !== snapshot.font_snapshot) {
    body.font_snapshot = draft.font_snapshot;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useResumeDraft(
  resumeId: string,
  initialResume: TailoredResume
): UseResumeDraftReturn {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const [mode, setMode] = React.useState<EditorMode>("preview");
  const [snapshot, setSnapshot] = React.useState<EditableSnapshot>(() =>
    snapshotFromResume(initialResume)
  );
  const [draft, setDraft] = React.useState<EditableSnapshot>(() =>
    snapshotFromResume(initialResume)
  );

  // If the underlying resume changes (e.g. cache update from a sibling rename
  // or after Save) AND we're not in Edit mode, sync the snapshot/draft. We
  // never overwrite an in-flight Edit-mode draft from upstream.
  React.useEffect(() => {
    if (mode === "edit") return;
    setSnapshot(snapshotFromResume(initialResume));
    setDraft(snapshotFromResume(initialResume));
  }, [initialResume, mode]);

  const isDirty = React.useMemo(
    () => isDraftDirty(draft, snapshot),
    [draft, snapshot]
  );

  // ---- Save mutation -------------------------------------------------------

  const saveMutation = useMutation<
    TailoredResume,
    TailorError,
    TailoredResumePatchRequest
  >({
    mutationFn: (body) => patchTailoredResume(resumeId, body),
  });

  const saveEdit = React.useCallback(async () => {
    // Sanitize all Tiptap-output HTML fields via DOMPurify (TAILOR-10) so the
    // diff and the wire payload are both XSS-safe. Returns a new deep-cloned
    // ProfileData; the input is not mutated.
    const sanitizedDraft: EditableSnapshot = {
      ...draft,
      tailored_data: sanitizeTailoredData(draft.tailored_data),
    };
    const body = buildPatchBody(sanitizedDraft, snapshot);
    if (Object.keys(body).length === 0) {
      // Nothing to save — exit Edit mode silently.
      setMode("preview");
      return;
    }
    try {
      const updated = await saveMutation.mutateAsync(body);
      const next = snapshotFromResume(updated);
      setSnapshot(next);
      setDraft(next);
      queryClient.setQueryData(queryKeys.resumes.detail(resumeId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.lists() });
      toast.success("Changes saved.");
      setMode("preview");
    } catch (err) {
      const message =
        err instanceof TailorError
          ? err.code === "NOT_IMPLEMENTED"
            ? "Saving isn't available yet. Backend endpoint pending."
            : err.code === "JOB_NOT_FOUND"
              ? "This resume no longer exists."
              : "Save failed. Please try again."
          : "Save failed. Please try again.";
      toast.error(message);
      // Stay in Edit mode; draft preserved.
    }
  }, [draft, snapshot, queryClient, resumeId, saveMutation]);

  // ---- Discard / Cancel ---------------------------------------------------

  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false);
  // What to do AFTER the user confirms discard. Defaults to "exit Edit mode".
  // Navigation guard overrides this with a `router.push(href)` continuation.
  const pendingDiscardActionRef = React.useRef<(() => void) | null>(null);

  const forceCancelEdit = React.useCallback(() => {
    setDraft(snapshot);
    setMode("preview");
  }, [snapshot]);

  const cancelEdit = React.useCallback(() => {
    if (!isDirty) {
      forceCancelEdit();
      return;
    }
    pendingDiscardActionRef.current = () => {
      setDraft(snapshot);
      setMode("preview");
    };
    setDiscardDialogOpen(true);
  }, [isDirty, snapshot, forceCancelEdit]);

  const confirmDiscard = React.useCallback(() => {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    if (action) action();
    else forceCancelEdit();
  }, [forceCancelEdit]);

  // ---- Setters -------------------------------------------------------------

  const enterEdit = React.useCallback(() => {
    // Re-snapshot from CURRENT cache state in case it changed between
    // load and Edit click (e.g. filename was renamed).
    const cached = queryClient.getQueryData<TailoredResume>(
      queryKeys.resumes.detail(resumeId)
    );
    const base = cached
      ? snapshotFromResume(cached)
      : snapshotFromResume(initialResume);
    setSnapshot(base);
    setDraft(structuredClone(base));
    setMode("edit");
  }, [queryClient, resumeId, initialResume]);

  const setDraftFont = React.useCallback((font: string) => {
    setDraft((prev) => ({ ...prev, font_snapshot: font }));
  }, []);

  const setDraftSectionsOrder = React.useCallback((order: string[]) => {
    setDraft((prev) => ({ ...prev, sections_order_snapshot: [...order] }));
  }, []);

  const setDraftTailoredData = React.useCallback((data: ProfileData) => {
    setDraft((prev) => ({ ...prev, tailored_data: data }));
  }, []);

  // ---- Navigation guards --------------------------------------------------

  // (A) beforeunload — browser tab close / hard refresh.
  React.useEffect(() => {
    if (mode !== "edit" || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy Chrome compat — most modern browsers ignore the string.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, isDirty]);

  // (B) Anchor-click intercept — Next.js <Link> emits real <a> click events,
  // and the sidebar uses <Link>. We capture-phase listen on document so we
  // run BEFORE Next.js's router. If the click targets an in-app href that
  // would change the pathname (and the user is dirty in Edit mode), we
  // preventDefault, open the discard dialog, and queue the navigation as
  // the post-confirm action.
  React.useEffect(() => {
    if (mode !== "edit" || !isDirty) return;

    const handleClick = (e: MouseEvent) => {
      // Ignore modified clicks (cmd/ctrl/shift/alt) — let new-tab work.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return; // left click only
      if (e.defaultPrevented) return;

      // Walk up to find an anchor. composedPath() handles shadow DOM; we
      // fall back to manual traversal for older Safari.
      const path =
        typeof e.composedPath === "function" ? e.composedPath() : [];
      let anchor: HTMLAnchorElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
      }
      if (!anchor) {
        let cur: HTMLElement | null = e.target as HTMLElement | null;
        while (cur && cur !== document.body) {
          if (cur instanceof HTMLAnchorElement) {
            anchor = cur;
            break;
          }
          cur = cur.parentElement;
        }
      }
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      // Skip non-navigational anchors.
      if (href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      // Resolve absolute URL to compare origins.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // In-page link to the SAME pathname → not a navigation.
      if (url.pathname === pathname) return;

      // It's a real client-side navigation. Intercept.
      e.preventDefault();
      e.stopPropagation();

      pendingDiscardActionRef.current = () => {
        setDraft(snapshot);
        setMode("preview");
        // Defer router push to next tick so the mode change flushes.
        // We use window.location for cross-router compatibility — Next
        // intercepts same-origin hrefs and treats them as soft navs.
        setTimeout(() => {
          window.location.href = url.toString();
        }, 0);
      };
      setDiscardDialogOpen(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mode, isDirty, pathname, snapshot]);

  // (C) popstate — browser back/forward. We push a sentinel state on entering
  // Edit and listen for popstate; on dirty pop, we re-push history (cancel
  // the navigation visually) and open the dialog.
  React.useEffect(() => {
    if (mode !== "edit") return;
    // Push a sentinel so the next back press triggers popstate at our level.
    const sentinel = { __resumeEditGuard: true, ts: Date.now() };
    window.history.pushState(sentinel, "");

    const handlePopState = () => {
      if (!isDirty) {
        // Allow navigation through; mode will rehydrate on next page.
        return;
      }
      // Re-push the sentinel so the user stays on this page until they decide.
      window.history.pushState({ ...sentinel, ts: Date.now() }, "");
      pendingDiscardActionRef.current = () => {
        setDraft(snapshot);
        setMode("preview");
        setTimeout(() => {
          window.history.back();
        }, 0);
      };
      setDiscardDialogOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
    // We deliberately re-bind on isDirty so the closure sees the latest value.
  }, [mode, isDirty, snapshot]);

  return {
    mode,
    draft,
    snapshot,
    isDirty,
    isSaving: saveMutation.isPending,
    enterEdit,
    cancelEdit,
    forceCancelEdit,
    saveEdit,
    setDraftFont,
    setDraftSectionsOrder,
    setDraftTailoredData,
    discardDialogOpen,
    setDiscardDialogOpen,
    confirmDiscard,
  };
}
