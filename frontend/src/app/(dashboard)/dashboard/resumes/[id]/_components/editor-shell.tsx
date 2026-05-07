"use client";

/**
 * TAILOR-8 / TAILOR-9 / TAILOR-11 — Editor shell (client).
 *
 * Loads the TailoredResume, renders the breadcrumb / title / download chrome,
 * and embeds `<ResumePreview>` inside `<PreviewFrame>`. Hosts the Preview-
 * mode Edit button OR the Edit-mode toolbar in the frame's top-edge slot,
 * driven by the `useResumeDraft` state machine.
 *
 * The filename rename flow (`<InlineFilenameEditor>`) commits IMMEDIATELY
 * via PATCH `name` and intentionally does NOT route through the draft model
 * — see editor-edit-mode-spec §1.5. This decoupling means renaming during
 * Edit mode does not interact with Cancel/Save and renaming outside Edit
 * mode does not touch any draft state.
 *
 * Specs:
 *   - docs/v2/specs/tailor-flow-spec.md §3
 *   - docs/v2/specs/editor-edit-mode-spec.md §1, §2, §3, §4, §5
 */
import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ResumePreview } from "@/components/resume/resume-preview";
import { queryKeys } from "@/hooks/api/keys";
import {
  getTailoredResume,
  markRatingModalShown,
  TailorError,
  type TailoredResume,
} from "@/lib/tailored-resume-api";
import {
  RESUME_FONTS,
  type ResumeFont,
} from "@/lib/fonts/resume-fonts";

import { EditablePreview } from "@/components/resume/editor/editable-preview";
import { KeywordScrollProvider } from "@/lib/resume/keyword-scroll-context";

import { EditorShellSkeleton } from "./editor-shell-skeleton";
import { InlineFilenameEditor } from "./inline-filename-editor";
import { DownloadButton } from "./download-button";
import { InsightsPanel } from "./insights-panel";
import { PreviewFrame } from "./preview-frame";
import { EditButton } from "./edit-button";
import { EditModeToolbar } from "./edit-mode-toolbar";
import { ReorderSectionsDialog } from "./reorder-sections-dialog";
import { DiscardChangesDialog } from "./discard-changes-dialog";
import { RatingModal } from "./rating-modal";
import { useResumeDraft } from "./use-resume-draft";

// TAILOR-13 — Per-session, per-resume guard so navigating away and back
// within the same SPA session does NOT re-fire the 15s timer + the
// markRatingModalShown POST. Module-scope is the simplest fit: it persists
// across <EditorChrome> remounts but resets on a hard reload (which is
// fine — `rating_modal_shown_at` will be set on the GET response by then,
// so the show-condition gate trips first anyway).
const ratingTimerFiredFor = new Set<string>();

interface EditorShellProps {
  id: string;
}

export function EditorShell({ id }: EditorShellProps) {
  const query = useQuery<TailoredResume, TailorError>({
    queryKey: queryKeys.resumes.detail(id),
    queryFn: () => getTailoredResume(id),
    staleTime: 1000 * 60,
    retry: (failureCount, err) => {
      // Don't retry "not found" / "not implemented" — these are deterministic.
      if (err instanceof TailorError) {
        if (err.code === "JOB_NOT_FOUND" || err.code === "NOT_IMPLEMENTED") {
          return false;
        }
      }
      return failureCount < 1;
    },
  });

  if (query.isLoading) return <EditorShellSkeleton />;

  // Friendly 404 — covers both "row not found" and the (current) 404/405 from
  // the missing GET endpoint, so the editor degrades gracefully.
  if (query.isError) {
    return <NotFoundState />;
  }

  if (!query.data) {
    return <NotFoundState />;
  }

  return <EditorChrome id={id} resume={query.data} />;
}

// ---------------------------------------------------------------------------
// Chrome (header + body grid)
// ---------------------------------------------------------------------------

function EditorChrome({ id, resume }: { id: string; resume: TailoredResume }) {
  // TAILOR-8 backend gap: `TailoredResumeResponse` does not currently
  // include the joined Job — so we can't render
  // "Resume tailored for {company_name}" (spec §3.5) without a follow-up
  // fetch. Fall back to the spec's documented alternative until backend-dev
  // either adds a `job` relation to the response or we fetch the job
  // separately via `resume.job_id`.
  const subtitle = "Resume tailored from your profile";

  // ---- Edit-mode draft state ----
  const draftState = useResumeDraft(id, resume);
  const {
    mode,
    draft,
    isDirty,
    isSaving,
    enterEdit,
    cancelEdit,
    saveEdit,
    setDraftFont,
    setDraftSectionsOrder,
    setDraftTailoredData,
    discardDialogOpen,
    setDiscardDialogOpen,
    confirmDiscard,
  } = draftState;

  const [reorderOpen, setReorderOpen] = React.useState(false);
  // Validity comes from the EditableTemplate (currently only email pattern).
  // When invalid, the Save button is disabled with a tooltip.
  const [isValid, setIsValid] = React.useState(true);

  // Coerce font_snapshot to a known ResumeFont; fall back to Inter. The draft
  // is the live source of truth in Edit mode AND in Preview (it just equals
  // the snapshot when not editing).
  const liveFont: ResumeFont = (RESUME_FONTS as readonly string[]).includes(
    draft.font_snapshot
  )
    ? (draft.font_snapshot as ResumeFont)
    : "Inter";

  const liveSectionsOrder =
    draft.sections_order_snapshot && draft.sections_order_snapshot.length > 0
      ? draft.sections_order_snapshot
      : [
          "summary",
          "employment",
          "education",
          "skills",
          "languages",
          "projects",
          "certificates",
          "achievements",
          "volunteer",
        ];

  // ---- Keyboard shortcuts (Cmd/Ctrl+S, Esc) ----
  React.useEffect(() => {
    if (mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S: Save (only when dirty + not already saving)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !isSaving && isValid) {
          void saveEdit();
        }
        return;
      }
      // Esc: Cancel (when no modal is currently open — Radix Dialog Esc
      // closes the modal first, so editor-level Esc only fires here).
      if (e.key === "Escape") {
        // If reorder modal or discard modal is open, the modal handles Esc.
        if (reorderOpen || discardDialogOpen) return;
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    mode,
    isDirty,
    isSaving,
    isValid,
    reorderOpen,
    discardDialogOpen,
    saveEdit,
    cancelEdit,
  ]);

  // ---- TAILOR-13: post-generation rating modal (15s after editor open) ----
  //
  // Owned here (NOT in <RatingModal>) so the timer + the markRatingModalShown
  // POST fire even when the modal itself isn't visible (e.g. user is in Edit
  // mode at second 15 — we still want to register the attempt). See spec §1.1.
  //
  // Show condition is snapshotted FROM THE RESUME AT TIMER FIRE, not at mount,
  // because the React Query cache may have been refetched between mount and
  // the 15-second mark.
  const [ratingOpen, setRatingOpen] = React.useState(false);
  const [ratingPendingShow, setRatingPendingShow] = React.useState(false);
  const queryClient = useQueryClient();

  // Live-read mirror of `mode` so the timer callback (closed over an old
  // `mode` value at effect-run time) can branch on the CURRENT mode at the
  // 15s mark. Declared BEFORE the timer effect so TypeScript / JS resolve
  // the reference cleanly inside the setTimeout closure.
  const modeRef = React.useRef(mode);
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    // Per-session, per-resume idempotency: if the timer already fired for
    // this resume in this SPA session, don't re-arm. This handles in-app
    // navigation back to the same resume page within the session.
    if (ratingTimerFiredFor.has(id)) return;

    // Pre-condition gate at MOUNT — if the resume already has either flag
    // set, never arm the timer. (We re-check at fire-time using the latest
    // cache snapshot to handle the race where another tab rated mid-window.)
    if (resume.rating_modal_shown_at !== null || resume.rating !== null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      // Snapshot at fire-time — query may have been refetched while we waited.
      const latest = queryClient.getQueryData<TailoredResume>(
        queryKeys.resumes.detail(id)
      );
      const shownAt =
        latest?.rating_modal_shown_at ?? resume.rating_modal_shown_at;
      const ratingValue = latest?.rating ?? resume.rating;
      if (shownAt !== null || ratingValue !== null) {
        // Race: somewhere in the 15s window the resume was already rated /
        // marked-shown. Bail without showing the modal.
        ratingTimerFiredFor.add(id);
        return;
      }

      // Mark the per-session guard immediately to prevent any pathway that
      // could re-arm (StrictMode double-effect, fast remount, etc.).
      ratingTimerFiredFor.add(id);

      // Fire-and-forget POST so the backend records the attempt even if the
      // user closes the tab during the 15s window.
      void markRatingModalShown(id);

      // Edit-mode interaction (spec §1.4): defer the visible Dialog open
      // until the user returns to Preview mode. The POST above still fires.
      if (modeRef.current === "edit") {
        setRatingPendingShow(true);
      } else {
        setRatingOpen(true);
      }
    }, 15_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // We intentionally depend ONLY on `id` so the timer runs at most once
    // per resume id mount. Re-running on resume identity changes (cache
    // refetch returning a new object) would arm a NEW timer at every cache
    // refresh, breaking the 15s contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Promote `pendingShow → open` when the user exits Edit mode.
  React.useEffect(() => {
    if (mode === "preview" && ratingPendingShow && !ratingOpen) {
      setRatingOpen(true);
      setRatingPendingShow(false);
    }
  }, [mode, ratingPendingShow, ratingOpen]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Resumes", href: "/dashboard/resumes" },
          {
            label:
              resume.name.length > 40
                ? resume.name.slice(0, 40) + "…"
                : resume.name,
          },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <InlineFilenameEditor
            resumeId={resume.id}
            initialName={resume.name}
          />
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <DownloadButton
          resumeId={resume.id}
          disabledReason={
            mode === "edit" ? "Save your changes to download." : undefined
          }
        />
      </div>

      {/*
        Two-column layout (document + side panel) only at 2xl (≥1536px). Below
        that the side panel stacks BELOW the document so the document keeps
        full cell width — at lg (1024–1280) and xl (1280–1536) the dashboard
        sidebar already eats ~280px, and a fixed side panel shrinks the cell
        to a width where the document scales down to ~0.5–0.6 (unreadable).
        At 2xl there's enough room (≥912px cell after sidebar+panel) for the
        document to render at scale 1.0 alongside the panel.

        TAILOR-12: KeywordScrollProvider wraps both cells so chip clicks in
        the side panel can reach the Tiptap editors mounted by EditablePreview.
        The provider is a thin Map wrapper — it costs nothing to mount even
        when keywords are absent.
      */}
      <KeywordScrollProvider>
        <div className="grid gap-6 grid-cols-1 2xl:grid-cols-[1fr_320px]">
          <PreviewFrame mode={mode}>
            {mode === "edit" ? (
              <EditablePreview
                data={draft.tailored_data}
                font={liveFont}
                sections_order={liveSectionsOrder}
                onChange={setDraftTailoredData}
                onValidityChange={setIsValid}
                keywords={resume.matched_keywords}
                topSlot={
                  <EditModeToolbar
                    font={liveFont}
                    onFontChange={setDraftFont}
                    onOpenReorder={() => setReorderOpen(true)}
                    onCancel={cancelEdit}
                    onSave={() => void saveEdit()}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    isValid={isValid}
                  />
                }
              />
            ) : (
              <ResumePreview
                data={draft.tailored_data}
                font={liveFont}
                sections_order={liveSectionsOrder}
                template="classic"
                topSlot={<EditButton onClick={enterEdit} />}
              />
            )}
          </PreviewFrame>

          {/* Side panel: hidden on mobile, stacks on tablet, sticky on desktop. */}
          <div className="hidden md:block">
            <InsightsPanel
              matchedKeywords={resume.matched_keywords}
              appliedChanges={resume.applied_changes}
              sectionsOrder={liveSectionsOrder}
              isEditMode={mode === "edit"}
            />
          </div>
        </div>
      </KeywordScrollProvider>

      {/* Reorder sections dialog (Edit mode only — but mounted always so
          the open/close transition is smooth; trigger button only appears
          in Edit mode toolbar). */}
      <ReorderSectionsDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        currentOrder={liveSectionsOrder}
        data={draft.tailored_data}
        onSave={setDraftSectionsOrder}
      />

      {/* Discard-changes dialog. Mounted once at page root and driven by the
          draft hook (Cancel + navigation guards both share this surface). */}
      <DiscardChangesDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        onConfirm={confirmDiscard}
      />

      {/* TAILOR-13 — Post-generation rating modal. Mounted unconditionally
          at the page root; the open prop is driven by the 15s timer + the
          Edit-mode pendingShow logic above. */}
      <RatingModal
        resumeId={id}
        open={ratingOpen}
        onOpenChange={setRatingOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 state
// ---------------------------------------------------------------------------

function NotFoundState() {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto max-w-md text-center py-16 space-y-4">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight focus:outline-none"
      >
        Resume not found
      </h1>
      <p className="text-sm text-muted-foreground">
        This resume doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/dashboard/resumes">Back to Resumes</Link>
      </Button>
    </div>
  );
}
