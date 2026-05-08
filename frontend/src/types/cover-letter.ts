// Cover letter feature type definitions matching backend v2.1 Pydantic schemas
// (app/schemas/cover_letter.py).

export type CLStyle = 'formal' | 'professional' | 'job_matched';
export type CLTone = 'confident' | 'humble' | 'enthusiastic';
export type CLLength = 'short' | 'medium' | 'long';

/**
 * Source of truth for the wizard's source-data branch.
 * Mirrors backend `SourceType` literal in `app/schemas/cover_letter.py`.
 */
export type CLSourceType = 'tailored_resume' | 'profile';

/**
 * Tiptap JSON document shape — kept as `Record<string, unknown>` because the
 * editor's data-binding adapter only flattens paragraphs to plain text.
 * Anything richer would require depending on Tiptap types here, which we
 * deliberately avoid (CL editor is plain-text + live preview, no toolbar).
 */
export type TiptapDocument = Record<string, unknown>;

// ---------------------------------------------------------------------------
// CL-2 wizard variants (3 in-memory items, never persisted)
// ---------------------------------------------------------------------------

export interface CoverLetterVariant {
  content: string;
  /**
   * DEPRECATED — the v2.1 backend (`CoverLetterVariantResponse`) only returns
   * `content`. Kept optional so any legacy reader still type-checks.
   */
  label?: string;
}

/** Legacy response shape for the deprecated `/api/v1/cover-letters/generate`. */
export interface GenerateVariantsResponse {
  cover_letter_id: string;
  variants: CoverLetterVariant[];
}

// ---------------------------------------------------------------------------
// Persisted CoverLetter (v2.1) — matches backend `CoverLetterResponse`.
// ---------------------------------------------------------------------------

export interface CoverLetterListItem {
  id: string;
  job_id: string | null;
  name: string;
  source_type: CLSourceType;
  style: CLStyle;
  tone: CLTone;
  /** Backend aliases DB column `length_setting` → API field `length`. */
  length: CLLength;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterResponse {
  id: string;
  user_id: string;
  job_id: string | null;
  name: string;
  source_type: CLSourceType;
  /**
   * Immutable point-in-time snapshot of the source used for generation
   * (TR `tailored_data` or Profile `profile_data`). The editor does not
   * display this; it is informational only per CL-8 spec.
   */
  source_snapshot: Record<string, unknown>;
  /** Tiptap JSON document (`{type:"doc", content:[...]}`). */
  content: TiptapDocument;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  additional_context: string | null;
  created_at: string;
  updated_at: string;
}
