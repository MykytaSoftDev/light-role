"use client";

/**
 * TAILOR-12 — KeywordHighlightContext.
 *
 * Spec: docs/v2/specs/insights-panel-spec.md §2.6 / §8.7.
 *
 * Each `<TiptapField>` that receives a `keywords` prop registers itself with
 * this context on mount and unregisters on unmount. The Insights panel's
 * Matched Keywords chip click handler asks the context for the first editor
 * whose document text contains a given term and (if found) focuses it +
 * scrolls it into view.
 *
 * Editors are tracked in a Map keyed by the registration token (a stable
 * symbol per mount). Iteration order is insertion order, which corresponds
 * to mount order — close enough to "DOM order" for the typical case where
 * sections are mounted top-to-bottom by `EditableTemplate`.
 */
import * as React from "react";
import type { Editor } from "@tiptap/react";

interface RegisteredEditor {
  editor: Editor;
}

interface KeywordScrollContextValue {
  register: (token: symbol, entry: RegisteredEditor) => void;
  unregister: (token: symbol) => void;
  /**
   * Find the first editor whose document plain-text contains `term`
   * (case-insensitive, whole-word per the same boundary class as the
   * decoration plugin) and return it. Returns null if no editor matches.
   */
  findFirstOccurrence: (term: string) => { editor: Editor; from: number } | null;
}

const KeywordScrollContext =
  React.createContext<KeywordScrollContextValue | null>(null);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildWholeWordRegex(term: string): RegExp {
  return new RegExp(
    `(?<![\\w./+#-])${escapeRegex(term)}(?![\\w./+#-])`,
    "i"
  );
}

interface KeywordScrollProviderProps {
  children: React.ReactNode;
}

export function KeywordScrollProvider({ children }: KeywordScrollProviderProps) {
  // Use a ref-stored Map so registration mutations don't trigger re-renders
  // of every consumer. The provider's children read the value via a stable
  // function bag.
  const registryRef = React.useRef<Map<symbol, RegisteredEditor>>(new Map());

  const register = React.useCallback(
    (token: symbol, entry: RegisteredEditor) => {
      registryRef.current.set(token, entry);
    },
    []
  );

  const unregister = React.useCallback((token: symbol) => {
    registryRef.current.delete(token);
  }, []);

  const findFirstOccurrence = React.useCallback(
    (term: string): { editor: Editor; from: number } | null => {
      if (!term) return null;
      const rx = buildWholeWordRegex(term);
      // Iterate in insertion (≈ mount / DOM) order.
      for (const { editor } of registryRef.current.values()) {
        if (editor.isDestroyed) continue;
        // Walk text nodes; the first match wins.
        let found: { from: number } | null = null;
        editor.state.doc.descendants((node, pos) => {
          if (found) return false;
          if (!node.isText || !node.text) return true;
          const m = rx.exec(node.text);
          if (m) {
            found = { from: pos + m.index };
            return false;
          }
          return true;
        });
        if (found) return { editor, from: (found as { from: number }).from };
      }
      return null;
    },
    []
  );

  const value = React.useMemo<KeywordScrollContextValue>(
    () => ({ register, unregister, findFirstOccurrence }),
    [register, unregister, findFirstOccurrence]
  );

  return (
    <KeywordScrollContext.Provider value={value}>
      {children}
    </KeywordScrollContext.Provider>
  );
}

/** Returns the context value, or null if no provider is mounted (Preview mode). */
export function useKeywordScroll(): KeywordScrollContextValue | null {
  return React.useContext(KeywordScrollContext);
}
