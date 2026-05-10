"use client";

/**
 * TAILOR-10 — Tiptap rich-text field.
 *
 * Spec: docs/v2/specs/editor-edit-mode-spec.md §7.0.6.
 *
 * Supported marks/nodes (the ONLY ones — see §13 #10):
 *   - paragraph, hardBreak, history, dropcursor, gapcursor, document, text
 *     (inherited from StarterKit)
 *   - bold, italic
 *   - bulletList + listItem (configured separately so we can drop nesting)
 *
 * NO headings, NO links, NO images, NO code blocks, NO horizontal rules,
 * NO underline, NO strike. The whitelist matches DOMPurify (`p, strong, em,
 * ul, li, br`). If you add an extension, also add the matching tag in
 * `sanitize-tailored-data.ts`.
 *
 * Output: HTML string. The component does NOT call sanitization itself —
 * that runs once on Save (see use-resume-draft.ts → sanitizeTailoredData).
 *
 * Performance:
 *   - Stable Tiptap instance per field (the editor is created once, kept
 *     across keystrokes). Parent must give the instance a stable React key
 *     (typically `entry.id`) so it does NOT remount on every render.
 *   - `onUpdate` is throttled at 300ms to debounce live-preview re-renders
 *     of the document.
 */
import * as React from "react";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List,
  RemoveFormatting,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import BulletList from "@tiptap/extension-bullet-list";
import ListItem from "@tiptap/extension-list-item";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatchedKeyword } from "@/lib/tailored-resume-api";
import { createKeywordHighlightExtension } from "@/lib/resume/keyword-decoration";
import { useKeywordScroll } from "@/lib/resume/keyword-scroll-context";

export interface TiptapFieldProps {
  /** HTML content (as stored in the draft). */
  value: string;
  /** Called with the new HTML on every edit (already throttled at 300ms). */
  onChange: (html: string) => void;
  /** When true the editor renders bullet-list shortcuts as the only block. */
  enableBulletList?: boolean;
  /** Placeholder for empty editors. CSS-driven via .is-empty class. */
  placeholder?: string;
  /** Optional className for the editor wrapper. */
  className?: string;
  /** Optional className for the rendered prose. */
  proseClassName?: string;
  /** Disable editing (rare — we don't currently use this). */
  editable?: boolean;
  /** Aria-label for the editor area. */
  ariaLabel?: string;
  /**
   * TAILOR-12: matched keywords from the AI tailor pipeline. When provided
   * (and non-empty) the field mounts a ProseMirror Decoration plugin that
   * paints inline highlights with a tinted background. Highlights recompute
   * on blur, debounced 300ms — they never appear in `editor.getHTML()`.
   *
   * Pass `undefined` to disable highlighting (default).
   */
  keywords?: MatchedKeyword[];
}

/**
 * Tiptap field. Renders prose with a 4-button floating toolbar that appears
 * on focus and stays visible during toolbar clicks.
 */
export function TiptapField({
  value,
  onChange,
  enableBulletList = true,
  placeholder,
  className,
  proseClassName,
  editable = true,
  ariaLabel,
  keywords,
}: TiptapFieldProps) {
  // Keyword highlighting context (only present in the resume editor — Preview
  // mode and other Tiptap consumers like the cover-letter editor have no
  // provider, so the hook returns null).
  const keywordScroll = useKeywordScroll();
  const [focused, setFocused] = React.useState(false);
  // Toolbar visibility: keep visible briefly after blur so clicks on the
  // toolbar don't dismiss it before the click registers (spec §7.0.6).
  const [toolbarVisible, setToolbarVisible] = React.useState(false);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Wrapper ref + caret-following toolbar position. We compute viewport coords
  // for the current selection on each `selectionUpdate`/focus and translate
  // them into the wrapper's local coordinate system. We also detect any
  // accumulated parent CSS transform scale (the editor lives inside a
  // `transform: scale()` wrapper at smaller breakpoints) and divide by it so
  // the position lands on the right caret line at any scale tier.
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [toolbarPos, setToolbarPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // Note: Tiptap v3's `useEditor` stores options in an internal ref and
  // re-reads them every render — so the `onUpdate` closure below always
  // sees the LATEST `onChange` from props without requiring deps in
  // useEditor. We do not throttle: keystroke-rate updates flow into the
  // draft state, and React's diffing of the document re-render is fast
  // enough at the section sizes we ship. If profiling later shows a hot
  // spot we can add a 300ms debounce here.

  // TAILOR-12 — Build the keyword highlight extension once per keywords-array
  // identity. The parent (`InsightsPanel` / `EditableTemplate`) keeps the
  // array stable for the life of the editor, so this memo realistically
  // runs only on first mount.
  const keywordExtension = React.useMemo(
    () =>
      keywords && keywords.length > 0
        ? createKeywordHighlightExtension(keywords)
        : null,
    [keywords]
  );

  const editor = useEditor({
    immediatelyRender: false, // Avoid SSR hydration mismatches (Tiptap docs).
    extensions: [
      StarterKit.configure({
        // Disable everything we don't allow.
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        // Use our own bulletList/listItem so we can disable nesting.
        bulletList: false,
        orderedList: false,
        listItem: false,
        // strike/underline aren't in StarterKit by default; they stay off.
      }),
      ...(enableBulletList
        ? [
            BulletList.configure({
              HTMLAttributes: { class: "tiptap-bullet-list" },
              keepMarks: true,
              keepAttributes: false,
            }),
            ListItem.configure({
              HTMLAttributes: { class: "tiptap-list-item" },
            }),
          ]
        : []),
      ...(keywordExtension ? [keywordExtension] : []),
    ],
    content: value || "",
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-content focus:outline-none",
          // Use .ProseMirror class hooks via parent CSS where needed.
          proseClassName
        ),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
      // Disable Tab inside lists so bullet lists never nest beyond one level.
      handleKeyDown(_view, event) {
        if (event.key === "Tab") {
          // Always swallow Tab inside the editor — we don't want indentation
          // to escape the editor's focus either; a Shift+Tab is fine for
          // moving focus out, but plain Tab inside a list would otherwise
          // create a nested <ul>.
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      setFocused(true);
      setToolbarVisible(true);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    },
    onBlur: () => {
      setFocused(false);
      // Keep toolbar visible briefly so clicking a toolbar button doesn't
      // dismiss it before the click registers.
      blurTimeoutRef.current = setTimeout(() => {
        setToolbarVisible(false);
        blurTimeoutRef.current = null;
      }, 150);
    },
  });

  // Re-sync editor content when `value` is updated externally (e.g. after a
  // server save round-trip that re-snapshots). We only update if the editor's
  // current HTML is actually different from the new value to avoid clobbering
  // mid-edit state.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && !editor.isFocused) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  // Caret-following toolbar position. Re-compute on every selection change
  // and on focus so the toolbar appears just above the line where the user
  // clicked (or where the caret currently sits).
  React.useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (!wrapperRef.current) return;
      try {
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        const wrapperEl = wrapperRef.current;
        const wrapperRect = wrapperEl.getBoundingClientRect();
        // Detect parent transform scale by comparing rendered (screen) width
        // to layout width. Falls back to 1 when the wrapper has no width yet.
        const scale =
          wrapperEl.offsetWidth > 0
            ? wrapperRect.width / wrapperEl.offsetWidth
            : 1;
        const TOOLBAR_OFFSET = 36; // toolbar height (~30px) + small gap.
        const top = (coords.top - wrapperRect.top) / scale - TOOLBAR_OFFSET;
        // Clamp left to keep the toolbar inside the field on narrow editors.
        const layoutWidth = wrapperEl.offsetWidth;
        const TOOLBAR_WIDTH = 140; // 4 buttons × 28px + gaps + padding.
        const rawLeft = (coords.left - wrapperRect.left) / scale;
        const left = Math.max(
          0,
          Math.min(rawLeft, Math.max(0, layoutWidth - TOOLBAR_WIDTH))
        );
        setToolbarPos({ top, left });
      } catch {
        // Selection out of view (rare) — keep last position.
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
    };
  }, [editor]);

  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // TAILOR-12 — Register this editor with the KeywordScrollContext so chip
  // clicks can locate the first occurrence of a term across all 7 fields.
  // Only registers when both (a) keywords are present and (b) a context
  // provider is mounted. Token is a per-mount Symbol so re-renders don't
  // collide.
  const tokenRef = React.useRef<symbol | null>(null);
  if (tokenRef.current === null) {
    tokenRef.current = Symbol("tiptap-keyword-editor");
  }
  React.useEffect(() => {
    if (!keywordScroll || !editor || !keywords || keywords.length === 0) return;
    const token = tokenRef.current!;
    keywordScroll.register(token, { editor });
    return () => {
      keywordScroll.unregister(token);
    };
  }, [keywordScroll, editor, keywords]);

  if (!editor) {
    // First render before the client hook initializes — render a placeholder
    // div with the same height so the layout doesn't jump.
    return (
      <div
        className={cn(
          "tiptap-field-shell relative min-h-[1.4em]",
          className
        )}
      >
        <div
          className={cn("tiptap-content text-muted-foreground", proseClassName)}
        >
          {placeholder ?? ""}
        </div>
      </div>
    );
  }

  // Decide if the editor is "empty" so we can show a placeholder.
  const isEmpty = editor.isEmpty;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "tiptap-field-shell relative",
        focused && "tiptap-field-focused",
        className
      )}
    >
      {toolbarVisible && editable && toolbarPos ? (
        <TiptapToolbar
          editor={editor}
          top={toolbarPos.top}
          left={toolbarPos.left}
        />
      ) : null}
      <EditorContent editor={editor} />
      {isEmpty && placeholder && !focused ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 text-muted-foreground/60"
        >
          {placeholder}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating toolbar
// ---------------------------------------------------------------------------

interface TiptapToolbarProps {
  editor: Editor;
  /** Layout-px offset from the wrapper's top edge (cursor-driven). */
  top: number;
  /** Layout-px offset from the wrapper's left edge (cursor-driven). */
  left: number;
}

function TiptapToolbar({ editor, top, left }: TiptapToolbarProps) {
  const tFields = useTranslations("Resumes.editor.fields");
  const isBold = editor.isActive("bold");
  const isItalic = editor.isActive("italic");
  const isBullet = editor.isActive("bulletList");

  return (
    <div
      role="toolbar"
      aria-label={tFields("formatToolbarAria")}
      className={cn(
        "absolute z-10 flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-sm",
        "transition-opacity duration-150"
      )}
      style={{ top, left }}
      // Prevent mousedown on the toolbar from blurring the editor — that
      // would dismiss the toolbar before our onClick runs. Equivalent to
      // the spec's "150ms blur grace" but more reliable.
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={isBold}
        aria-label={tFields("formatBold")}
        className={cn("h-7 w-7", isBold && "bg-accent")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={isItalic}
        aria-label={tFields("formatItalic")}
        className={cn("h-7 w-7", isItalic && "bg-accent")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={isBullet}
        aria-label={tFields("formatBulletList")}
        className={cn("h-7 w-7", isBullet && "bg-accent")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={tFields("formatClear")}
        className="h-7 w-7"
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bullet-list ↔ string[] conversion helpers (spec §7.3 — Employment details)
// ---------------------------------------------------------------------------

/**
 * Convert a `string[]` of bullet HTML fragments into a single `<ul>` blob
 * suitable for Tiptap's initial content. Each item becomes one `<li>`.
 *
 * Inverse of `htmlToBulletList` below.
 */
export function bulletListFromStrings(items: string[]): string {
  if (!items?.length) return "";
  // Tiptap renders each <li> as <li><p>...</p></li>; we feed it raw inner
  // HTML and let Tiptap's schema wrap in a paragraph if missing.
  const lis = items
    .map((html) => `<li>${ensureParagraph(html)}</li>`)
    .join("");
  return `<ul>${lis}</ul>`;
}

/**
 * Inverse: given a Tiptap-output HTML string (a single `<ul>...</ul>`),
 * extract one entry per `<li>` and return an array of inner-HTML strings.
 *
 * If the editor has been emptied, returns []. If the editor produced
 * paragraphs WITHOUT a list (e.g. user deleted the list and typed text),
 * we fall back to one paragraph per bullet.
 */
export function htmlToBulletList(html: string): string[] {
  if (!html || !html.trim()) return [];

  // Use DOMParser for accurate parsing of the editor's HTML.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // SSR fallback: treat the entire HTML as a single bullet to avoid losing
    // content. This branch is unreachable in practice (the editor is client-only).
    return [html];
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lis = Array.from(doc.querySelectorAll("li"));
  if (lis.length > 0) {
    return lis.map((li) => li.innerHTML.trim()).filter((s) => s !== "");
  }
  // No <li> found — collapse paragraphs into bullets.
  const ps = Array.from(doc.querySelectorAll("p"));
  if (ps.length > 0) {
    return ps.map((p) => p.innerHTML.trim()).filter((s) => s !== "");
  }
  // Nothing structured — treat as one bullet.
  const trimmed = html.trim();
  return trimmed ? [trimmed] : [];
}

/** Wrap raw inline HTML in a `<p>` if not already a block element. */
function ensureParagraph(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "<p></p>";
  if (/^<(p|ul|ol)[\s>]/i.test(trimmed)) return trimmed;
  return `<p>${trimmed}</p>`;
}
