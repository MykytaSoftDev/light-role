import { api } from './api';
import type {
  CoverLetterListItem,
  CoverLetterResponse,
  GenerateVariantsResponse,
  CLStyle,
  CLTone,
  CLLength,
  TiptapDocument,
} from '@/types/cover-letter';
import { LimitReachedError } from './resume-api';

// ---------------------------------------------------------------------------
// CL-8 — Tiptap <-> plain text round-trip helpers.
//
// The CL editor is a plain `<textarea>` per PRD §3.5.8, but the persisted
// content is a Tiptap JSON document (so the same row can later feed a richer
// editor / PDF renderer that walks the Tiptap tree). These helpers do the
// minimum-fidelity conversion the textarea needs:
//
//   READ  Tiptap doc → plain text     (paragraphs joined by '\n')
//   WRITE plain text → Tiptap doc     (matches backend `_wrap_plain_text_as_tiptap`)
//
// The read-side intentionally swallows nodes other than paragraphs/text — the
// wizard finalises with plain text, so until rich-text editing lands the doc
// only ever contains the simple shape produced by the server's wrapper.
// ---------------------------------------------------------------------------

interface TiptapTextNode {
  type?: string;
  text?: string;
  content?: TiptapTextNode[];
}

/**
 * Flatten a Tiptap document to plain text. One paragraph becomes one line;
 * empty paragraphs become blank lines (preserving spacing the AI produced).
 */
export function tiptapDocToPlainText(doc: TiptapDocument | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';
  const paragraphs = (doc as { content?: TiptapTextNode[] }).content ?? [];
  if (!Array.isArray(paragraphs)) return '';

  const lines: string[] = [];
  for (const node of paragraphs) {
    if (!node || node.type !== 'paragraph') {
      // Unknown block — render its inline text if any, otherwise blank line.
      lines.push(extractInlineText(node));
      continue;
    }
    lines.push(extractInlineText(node));
  }
  return lines.join('\n');
}

function extractInlineText(node: TiptapTextNode | undefined | null): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractInlineText).join('');
  }
  return '';
}

/**
 * Wrap plain text into the same minimal Tiptap document shape the backend
 * produces in `_wrap_plain_text_as_tiptap`. Keeping the FE wrapper symmetric
 * means a save right after a load is a no-op (no spurious whitespace drift).
 */
export function plainTextToTiptapDoc(text: string): TiptapDocument {
  if (text === '') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) =>
      line === ''
        ? { type: 'paragraph' }
        : { type: 'paragraph', content: [{ type: 'text', text: line }] },
    ),
  };
}

// ---------------------------------------------------------------------------
// Wizard types (CL-4..CL-7) — mirror backend `CoverLetterFinalizeRequest`
// in `app/schemas/cover_letter.py`.
// ---------------------------------------------------------------------------

export type CoverLetterSourceType = 'tailored_resume' | 'profile';

/** CL-2 variant shape — the wizard sees just `{ content }`. */
export interface CoverLetterVariantContent {
  content: string;
}

/** CL-2 response from POST /api/v1/jobs/{id}/cover-letter. */
export interface GenerateCoverLetterVariantsResponse {
  variants: CoverLetterVariantContent[];
}

export interface GenerateCoverLetterPayload {
  source_type: CoverLetterSourceType;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  /** Free-form, max 500 client-side / 2000 server-side. Empty string → null. */
  additional_context: string | null;
}

export interface FinalizeCoverLetterPayload {
  job_id: string;
  name: string;
  /** Plain text from the AI variant; backend wraps as Tiptap JSON. */
  content: string;
  source_type: CoverLetterSourceType;
  /**
   * Immutable point-in-time snapshot of TR `tailored_data` or Profile
   * `profile_data` (per PRD 6.6) — materialised client-side and round-tripped
   * to CL-3 verbatim. The backend stores it as-is; no re-fetch on the server.
   */
  source_snapshot: Record<string, unknown>;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  additional_context: string | null;
}

// ---------------------------------------------------------------------------
// Typed errors — analogous to `TailorError` in tailored-resume-api.ts.
// ---------------------------------------------------------------------------

export type CoverLetterErrorCode =
  | 'PROFILE_NOT_READY'
  | 'JOB_NOT_FOUND'
  | 'COVER_LETTER_ALREADY_EXISTS'
  | 'TAILORED_RESUME_NOT_FOUND'
  | 'AI_FAILED'
  | 'OUT_OF_QUOTA'
  | 'UNKNOWN';

export class CoverLetterError extends Error {
  code: CoverLetterErrorCode;
  /** Set on COVER_LETTER_ALREADY_EXISTS — backend includes `existing_id`. */
  existingCoverLetterId?: string;
  /** OUT_OF_QUOTA payload — only the wizard's UpgradeModal reads these. */
  currentUsage?: number;
  limit?: number;
  resetDate?: string;
  planSlug?: string;

  constructor(
    code: CoverLetterErrorCode,
    message: string,
    extras?: {
      existingCoverLetterId?: string;
      currentUsage?: number;
      limit?: number;
      resetDate?: string;
      planSlug?: string;
    },
  ) {
    super(message);
    this.name = 'CoverLetterError';
    this.code = code;
    this.existingCoverLetterId = extras?.existingCoverLetterId;
    this.currentUsage = extras?.currentUsage;
    this.limit = extras?.limit;
    this.resetDate = extras?.resetDate;
    this.planSlug = extras?.planSlug;
  }
}

interface BackendErrorBody {
  detail?:
    | string
    | {
        detail?: string;
        error_code?: string;
        existing_id?: string;
        current_usage?: number;
        limit?: number;
        reset_date?: string;
        plan_slug?: string;
      };
}

async function readBackendError(res: Response): Promise<BackendErrorBody> {
  try {
    return (await res.json()) as BackendErrorBody;
  } catch {
    return {};
  }
}

function extractDetailObj(
  body: BackendErrorBody,
): Exclude<BackendErrorBody['detail'], string | undefined> | undefined {
  if (body.detail && typeof body.detail === 'object') return body.detail;
  return undefined;
}

function extractDetailString(body: BackendErrorBody): string | undefined {
  if (typeof body.detail === 'string') return body.detail;
  if (body.detail && typeof body.detail === 'object') return body.detail.detail;
  return undefined;
}

export async function listCoverLetters(
  jobId?: string
): Promise<{ items: CoverLetterListItem[]; total: number }> {
  const url = jobId
    ? `/api/v1/cover-letters/?job_id=${encodeURIComponent(jobId)}`
    : '/api/v1/cover-letters/';
  const res = await api.get(url);
  if (!res.ok) throw new Error(`Failed to fetch cover letters: HTTP ${res.status}`);
  return res.json();
}

/**
 * Thrown by `getCoverLetter` so the editor page can branch on 404 (friendly
 * not-found state) vs other failures (generic error). Backend always 404s
 * for not-owned IDs too, so the UI doesn't need to handle 403 separately.
 */
export class CoverLetterFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CoverLetterFetchError';
    this.status = status;
  }
}

export async function getCoverLetter(id: string): Promise<CoverLetterResponse> {
  const res = await api.get(`/api/v1/cover-letters/${id}`);
  if (!res.ok) {
    throw new CoverLetterFetchError(
      res.status,
      `Failed to fetch cover letter: HTTP ${res.status}`,
    );
  }
  return res.json();
}

export async function generateCoverLetter(data: {
  job_id: string;
  resume_id: string;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  additional_context: string;
}): Promise<GenerateVariantsResponse> {
  const res = await api.post('/api/v1/cover-letters/generate', data);
  if (!res.ok) {
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      throw new LimitReachedError(json?.detail ?? { message: "Limit reached", current_usage: 0, limit: 10, reset_date: "" });
    }
    throw new Error(`Failed to generate cover letter: HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Wizard endpoints (CL-2 + CL-3) — added in Phase 4 (CL-4..CL-7).
// ---------------------------------------------------------------------------

/**
 * CL-2 — POST /api/v1/jobs/{job_id}/cover-letter → 200 with `{ variants: [...] }`.
 *
 * Status / error_code → typed `CoverLetterError`:
 *   - 404                                  → JOB_NOT_FOUND
 *   - 409 COVER_LETTER_ALREADY_EXISTS      → COVER_LETTER_ALREADY_EXISTS (with id)
 *   - 400 PROFILE_NOT_READY                → PROFILE_NOT_READY
 *   - 400 TAILORED_RESUME_NOT_FOUND        → TAILORED_RESUME_NOT_FOUND
 *   - 502 AI_GENERATION_FAILED             → AI_FAILED  (no credit consumed)
 *   - 503 OUT_OF_CL_QUOTA (currently stubbed in backend; FE handles contract)
 *                                          → OUT_OF_QUOTA (with usage payload)
 *   - anything else                        → UNKNOWN
 *
 * Per spec §4.8, mutation callers map these codes to the right post-error UI:
 * Profile dialog, Already-Exists dialog, UpgradeModal, or just a toast.
 */
export async function generateCoverLetterVariants(
  jobId: string,
  payload: GenerateCoverLetterPayload,
): Promise<GenerateCoverLetterVariantsResponse> {
  let res: Response;
  try {
    res = await api.post(`/api/v1/jobs/${jobId}/cover-letter`, payload);
  } catch {
    throw new CoverLetterError('AI_FAILED', 'Network error during cover-letter generation.');
  }

  if (res.ok) {
    return (await res.json()) as GenerateCoverLetterVariantsResponse;
  }

  const body = await readBackendError(res);
  const detailObj = extractDetailObj(body);
  const message = extractDetailString(body) ?? `Generate failed (HTTP ${res.status})`;
  const code = detailObj?.error_code;

  if (res.status === 404) {
    throw new CoverLetterError('JOB_NOT_FOUND', message);
  }
  if (res.status === 409 || code === 'COVER_LETTER_ALREADY_EXISTS') {
    throw new CoverLetterError('COVER_LETTER_ALREADY_EXISTS', message, {
      existingCoverLetterId: detailObj?.existing_id,
    });
  }
  if (code === 'PROFILE_NOT_READY') {
    throw new CoverLetterError('PROFILE_NOT_READY', message);
  }
  if (code === 'TAILORED_RESUME_NOT_FOUND') {
    throw new CoverLetterError('TAILORED_RESUME_NOT_FOUND', message);
  }
  if (res.status === 502 || res.status === 504 || code === 'AI_GENERATION_FAILED') {
    throw new CoverLetterError('AI_FAILED', message);
  }
  if (res.status === 503 || code === 'OUT_OF_CL_QUOTA') {
    throw new CoverLetterError('OUT_OF_QUOTA', message, {
      currentUsage: detailObj?.current_usage,
      limit: detailObj?.limit,
      resetDate: detailObj?.reset_date,
      planSlug: detailObj?.plan_slug,
    });
  }

  throw new CoverLetterError('UNKNOWN', message);
}

/**
 * CL-3 — POST /api/v1/cover-letters → 201 with the inserted CoverLetter row.
 *
 * Mirrors the 404 / 409 contract from CL-2 (same `existing_id` on conflict).
 * Does NOT consume an AI credit — credit was already taken by CL-2.
 */
export async function finalizeCoverLetter(
  payload: FinalizeCoverLetterPayload,
): Promise<CoverLetterResponse> {
  let res: Response;
  try {
    res = await api.post('/api/v1/cover-letters', payload);
  } catch {
    throw new CoverLetterError('UNKNOWN', 'Network error while saving cover letter.');
  }

  if (res.ok) {
    return (await res.json()) as CoverLetterResponse;
  }

  const body = await readBackendError(res);
  const detailObj = extractDetailObj(body);
  const message = extractDetailString(body) ?? `Save failed (HTTP ${res.status})`;
  const code = detailObj?.error_code;

  if (res.status === 404) {
    throw new CoverLetterError('JOB_NOT_FOUND', message);
  }
  if (res.status === 409 || code === 'COVER_LETTER_ALREADY_EXISTS') {
    throw new CoverLetterError('COVER_LETTER_ALREADY_EXISTS', message, {
      existingCoverLetterId: detailObj?.existing_id,
    });
  }

  throw new CoverLetterError('UNKNOWN', message);
}

// ---------------------------------------------------------------------------
// Legacy endpoints — preserved per spec §11. Wizard does NOT import these
// any more, but other parts of the app (legacy editor, list page) still do.
// ---------------------------------------------------------------------------

export async function regenerateCoverLetter(
  id: string,
  data: {
    style?: CLStyle;
    tone?: CLTone;
    length?: CLLength;
    additional_context?: string;
  }
): Promise<GenerateVariantsResponse> {
  const res = await api.post(`/api/v1/cover-letters/${id}/regenerate`, data);
  if (!res.ok) {
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      throw new LimitReachedError(json?.detail ?? { message: "Limit reached", current_usage: 0, limit: 10, reset_date: "" });
    }
    throw new Error(`Failed to regenerate cover letter: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * PATCH /api/v1/cover-letters/{id} — v2.1 shape (`CoverLetterPatchRequest`).
 *
 * Only `name` and `content` are mutable per PRD 6.6 — style/tone/length and
 * source_type/source_snapshot are immutable after the wizard finalises. The
 * backend deliberately does not accept those fields any more.
 *
 * `content` must be a Tiptap JSON document. Callers that have plain text
 * (the editor's textarea) should run it through `plainTextToTiptapDoc` first.
 */
export async function updateCoverLetter(
  id: string,
  data: Partial<{
    name: string;
    content: TiptapDocument;
  }>,
): Promise<CoverLetterResponse> {
  const res = await api.patch(`/api/v1/cover-letters/${id}`, data);
  if (!res.ok) throw new Error(`Failed to update cover letter: HTTP ${res.status}`);
  return res.json();
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const res = await api.delete(`/api/v1/cover-letters/${id}`);
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete cover letter: HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// CL-9 — PDF + DOCX export endpoints. Both are free (no AI credit).
// Mirrors `downloadTailoredResume` in `tailored-resume-api.ts`: returns the
// blob; the caller does the anchor-click choreography.
//
// NOTE: at the time CL-8 was written, CL-9 was being implemented in parallel.
// If a 503/404 surfaces here, CL-9 has not yet landed — the editor's UI shows
// a friendly toast in that case.
// ---------------------------------------------------------------------------

/** POST /api/v1/cover-letters/{id}/download → application/pdf binary stream. */
export async function downloadCoverLetterPdf(id: string): Promise<Blob> {
  const res = await api.post(`/api/v1/cover-letters/${id}/download`);
  if (!res.ok) {
    throw new Error(`Failed to export PDF (HTTP ${res.status}).`);
  }
  return res.blob();
}

/** POST /api/v1/cover-letters/{id}/download-docx → DOCX binary stream. */
export async function downloadCoverLetterDocx(id: string): Promise<Blob> {
  const res = await api.post(`/api/v1/cover-letters/${id}/download-docx`);
  if (!res.ok) {
    throw new Error(`Failed to export DOCX (HTTP ${res.status}).`);
  }
  return res.blob();
}

/**
 * @deprecated CL-8 split this into two endpoint-specific functions
 * (`downloadCoverLetterPdf` / `downloadCoverLetterDocx`). Kept exported only
 * so any older import compiles; new code MUST use the split versions.
 */
export async function exportCoverLetter(id: string, format: 'pdf' | 'docx'): Promise<void> {
  const blob =
    format === 'pdf'
      ? await downloadCoverLetterPdf(id)
      : await downloadCoverLetterDocx(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cover-letter.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
