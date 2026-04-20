// Shared font registration for react-pdf resume templates.
//
// Why a shared module: both Minimal (RTV-3.1) and the in-progress Modern rewrite
// (RTV-2.x) need Inter. Fraunces is Minimal-only for now. Registering once here
// avoids duplicate Font.register calls and keeps a single source of truth for
// font URLs and fallback decisions.
//
// Delivery: jsDelivr CDN for @fontsource static .ttf files. Variable fonts are
// intentionally avoided — react-pdf's fontkit pipeline does not fully resolve
// variable-axis weights, so static per-weight files are required.
//
// Glyph coverage:
//   - Fraunces: jsDelivr/@fontsource ships Fraunces in `latin` and `latin-ext`
//     subsets only — there is NO cyrillic subset available. We register the
//     `latin-ext` files which cover Polish diacritics (ł, ż, ó, ń, ś, ć, ź,
//     ą, ę) cleanly. For Cyrillic text (e.g. "Андрей"), callers should detect
//     it and route those runs to Inter — see `isCyrillic` below.
//   - Inter: registered with `latin-ext` for Polish and `cyrillic` fallback
//     under the same family. react-pdf selects the first font whose subset
//     contains the glyph, so mixed Latin/Cyrillic strings in Inter just work.
//
// Registration is triggered by importing this module from each template's
// index.tsx. Font.register is idempotent in react-pdf, so multiple imports
// are safe.

import { Font } from "@react-pdf/renderer";

const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";

// ── Fraunces (serif display — name + section titles in Minimal) ──────────────
// Static weights 400 / 600, regular + italic, latin-ext subset (Polish OK,
// Cyrillic NOT covered by this subset).
Font.register({
  family: "Fraunces",
  fonts: [
    {
      src: `${CDN}/fraunces@latest/latin-ext-400-normal.ttf`,
      fontWeight: 400,
    },
    {
      src: `${CDN}/fraunces@latest/latin-ext-400-italic.ttf`,
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: `${CDN}/fraunces@latest/latin-ext-600-normal.ttf`,
      fontWeight: 600,
    },
  ],
});

// ── Inter (sans body — used everywhere non-display, and as Cyrillic fallback)─
// Weights 400, 500, 600, plus 400-italic. Two subsets per weight so the same
// family renders both Polish and Cyrillic without caller intervention.
Font.register({
  family: "Inter",
  fonts: [
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
    // 700 regular — Modern template uses 700 for the large name heading
    { src: `${CDN}/inter@latest/latin-ext-700-normal.ttf`, fontWeight: 700 },
    { src: `${CDN}/inter@latest/cyrillic-700-normal.ttf`, fontWeight: 700 },
  ],
});

// Hyphenation is off by default. react-pdf's built-in hyphenator mangles
// resume-style short runs (names, dates), so we explicitly disable it.
Font.registerHyphenationCallback((word) => [word]);

// ── Glyph-coverage helper ────────────────────────────────────────────────────
// Cyrillic Unicode block: U+0400–U+04FF (Cyrillic), U+0500–U+052F (Cyrillic
// Supplement). Any character in this range indicates Fraunces will render as
// .notdef boxes and we must fall back to Inter for the entire run.
export function isCyrillic(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[\u0400-\u052F]/.test(text);
}

// Convenience exports so templates use tokens instead of literal strings.
export const FONT_SERIF = "Fraunces";
export const FONT_SANS = "Inter";
