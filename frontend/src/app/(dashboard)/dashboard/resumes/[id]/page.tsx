/**
 * TAILOR-8 — Editor shell (Preview-mode only).
 *
 * Server component: page-level Suspense boundary. The actual data fetching
 * happens inside a client `EditorShell` so we reuse the React Query cache
 * shared with the rest of the dashboard. Edit mode (Tiptap, font selector,
 * reorder modal) is out of scope and lands in TAILOR-9 / 10 / 11.
 *
 * Spec: docs/v2/specs/tailor-flow-spec.md §3.
 */
import { Suspense } from "react";

import { EditorShell } from "./_components/editor-shell";
import { EditorShellSkeleton } from "./_components/editor-shell-skeleton";

export default async function ResumeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<EditorShellSkeleton />}>
      <EditorShell id={id} />
    </Suspense>
  );
}
