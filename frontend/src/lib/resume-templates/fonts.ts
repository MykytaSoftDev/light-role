// Shared font registration for react-pdf resume templates.
//
// Inter-only: after the visual-overhaul redesign (tasks-resume-templates-
// visual-overhaul.json), both Modern and Minimal use Inter exclusively.
// Classic also uses Inter. A single family with six weights covers every
// template's needs.
//
// Delivery: jsDelivr CDN for @fontsource static .ttf files. Variable fonts
// are intentionally avoided — react-pdf's fontkit pipeline does not fully
// resolve variable-axis weights, so static per-weight files are required.
//
// Glyph coverage: latin-ext (Polish diacritics ł/ż/ó/ń/ś/ć/ź/ą/ę) and
// cyrillic subsets are both registered under the same family. react-pdf
// selects the first font whose subset contains the glyph, so mixed Latin/
// Cyrillic strings just work.
//
// Registration is triggered by importing this module from each template's
// index.tsx. Font.register is idempotent in react-pdf, so multiple imports
// are safe.

import { Font } from "@react-pdf/renderer";

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

Font.register({
  family: "Inter",
  fonts: [
    // 300 light — Modern uses 300 for the wide-letter-spaced name
    { src: `${CDN}/inter@latest/latin-ext-300-normal.ttf`, fontWeight: 300 },
    { src: `${CDN}/inter@latest/cyrillic-300-normal.ttf`, fontWeight: 300 },
    // 400 regular
    { src: `${CDN}/inter@latest/latin-ext-400-normal.ttf`, fontWeight: 400 },
    { src: `${CDN}/inter@latest/cyrillic-400-normal.ttf`, fontWeight: 400 },
    // 400 italic
    {
      src: `${CDN}/inter@latest/latin-ext-400-italic.ttf`,
      fontWeight: 400,
      fontStyle: "italic",
    },
    // 500 regular
    { src: `${CDN}/inter@latest/latin-ext-500-normal.ttf`, fontWeight: 500 },
    { src: `${CDN}/inter@latest/cyrillic-500-normal.ttf`, fontWeight: 500 },
    // 600 regular
    { src: `${CDN}/inter@latest/latin-ext-600-normal.ttf`, fontWeight: 600 },
    { src: `${CDN}/inter@latest/cyrillic-600-normal.ttf`, fontWeight: 600 },
    // 700 regular
    { src: `${CDN}/inter@latest/latin-ext-700-normal.ttf`, fontWeight: 700 },
    { src: `${CDN}/inter@latest/cyrillic-700-normal.ttf`, fontWeight: 700 },
    // 800 extrabold — Minimal uses 800 for the heavy uppercase name
    { src: `${CDN}/inter@latest/latin-ext-800-normal.ttf`, fontWeight: 800 },
    { src: `${CDN}/inter@latest/cyrillic-800-normal.ttf`, fontWeight: 800 },
  ],
});

// Hyphenation is off by default. react-pdf's built-in hyphenator mangles
// resume-style short runs (names, dates), so we explicitly disable it.
Font.registerHyphenationCallback((word) => [word]);

// ── Preload helper (BF-2.1 — preview flicker fix) ────────────────────────────
// react-pdf lazily loads each registered font face on first use. If the
// preview mounts before the faces are resolved, it renders with Helvetica
// fallback, then re-renders per face as each .ttf finishes downloading —
// producing 5–6 visible flashes on a cold cache. `preloadFonts()` resolves
// every face we register up front so the preview can be gated behind a
// single "fonts ready" signal.
let fontsReadyPromise: Promise<void> | null = null;
export function preloadFonts(): Promise<void> {
  if (fontsReadyPromise) return fontsReadyPromise;
  fontsReadyPromise = Promise.all([
    Font.load({ fontFamily: "Inter", fontWeight: 300 }),
    Font.load({ fontFamily: "Inter", fontWeight: 400 }),
    Font.load({ fontFamily: "Inter", fontWeight: 400, fontStyle: "italic" }),
    Font.load({ fontFamily: "Inter", fontWeight: 500 }),
    Font.load({ fontFamily: "Inter", fontWeight: 600 }),
    Font.load({ fontFamily: "Inter", fontWeight: 700 }),
    Font.load({ fontFamily: "Inter", fontWeight: 800 }),
  ]).then(() => undefined);
  return fontsReadyPromise;
}

// ── Glyph-coverage helper ────────────────────────────────────────────────────
// Cyrillic Unicode block: U+0400–U+04FF (Cyrillic), U+0500–U+052F (Cyrillic
// Supplement). Retained as a utility for any caller that needs to detect
// cyrillic runs (e.g. for locale-specific styling), though the Inter
// registration now covers cyrillic natively so no fallback routing is needed.
export function isCyrillic(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[\u0400-\u052F]/.test(text);
}

export const FONT_SANS = "Inter";
