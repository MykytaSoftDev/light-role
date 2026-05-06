/**
 * TAILOR-10 — DOMPurify pass over Tiptap HTML fields in a `ProfileData`.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §8.2.
 *
 * Tiptap output is HTML, and the resume body renders it via
 * `dangerouslySetInnerHTML` (see `classic-template-spec.md` §5.1). Without
 * sanitization, an attacker who can write to a draft (e.g. via paste from a
 * malicious page) could inject arbitrary scripts into the rendered preview
 * AND the PDF render path. Sanitize before save so the persisted bytes are
 * safe regardless of where they're rendered later.
 *
 * Allowed tags: `p`, `strong`, `em`, `ul`, `li`, `br`. No attributes.
 * KEEP_CONTENT: true so unsafe wrappers strip but their text content remains.
 *
 * Returns a NEW deep-cloned `ProfileData`; the input is not mutated.
 */
import DOMPurify from "dompurify";

import type { ProfileData } from "@/lib/profile-api";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["p", "strong", "em", "ul", "li", "br"],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
};

/**
 * Sanitize a single HTML string. Tolerates null/undefined (returns "") and
 * non-string input (returns ""). DOMPurify runs in the browser DOM by default;
 * since this codebase only calls sanitize during the editor save flow (a
 * client component), we don't need a JSDOM shim.
 */
function sanitizeHtml(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  // dompurify .sanitize returns a string by default. If it ever returns a
  // TrustedHTML the consuming React APIs accept that too, but the type defs
  // say string. Cast defensively.
  return String(DOMPurify.sanitize(input, PURIFY_CONFIG));
}

/**
 * Walk the cloned data and sanitize all known Tiptap HTML fields.
 *
 * Fields covered (per spec §8.2):
 *   - `summary` (root-level string)
 *   - `employment[].details[]`
 *   - `education[].description`
 *   - `projects[].details[]`
 *   - `projects[].description`
 *   - `achievements[].description`
 *   - `volunteer[].details[]`
 *
 * Plain text fields (names, roles, dates, emails, urls) are NOT sanitized
 * here — they are rendered as text via React's normal escaping, never via
 * `dangerouslySetInnerHTML`. Sanitizing them would unnecessarily mangle
 * legitimate content like the `&` in "R&D".
 */
export function sanitizeTailoredData(data: ProfileData): ProfileData {
  // Deep clone first so the input is never mutated.
  const next: ProfileData = structuredClone(data);

  // Root summary
  next.summary = sanitizeHtml(next.summary);

  // Employment — details bullets
  if (Array.isArray(next.employment)) {
    for (const e of next.employment) {
      if (Array.isArray(e.details)) {
        e.details = e.details.map(sanitizeHtml);
      }
    }
  }

  // Education — single description per entry
  if (Array.isArray(next.education)) {
    for (const e of next.education) {
      if (e.description != null) {
        e.description = sanitizeHtml(e.description);
      }
    }
  }

  // Projects — details bullets + description
  if (Array.isArray(next.projects)) {
    for (const p of next.projects) {
      if (Array.isArray(p.details)) {
        p.details = p.details.map(sanitizeHtml);
      }
      if (p.description != null) {
        p.description = sanitizeHtml(p.description);
      }
    }
  }

  // Achievements — description per entry
  if (Array.isArray(next.achievements)) {
    for (const a of next.achievements) {
      if (a.description != null) {
        a.description = sanitizeHtml(a.description);
      }
    }
  }

  // Volunteer — details bullets
  if (Array.isArray(next.volunteer)) {
    for (const v of next.volunteer) {
      if (Array.isArray(v.details)) {
        v.details = v.details.map(sanitizeHtml);
      }
    }
  }

  return next;
}
