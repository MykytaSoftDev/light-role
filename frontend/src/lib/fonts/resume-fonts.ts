/**
 * TAILOR-5 (frontend half) — `next/font` setup for the 5 resume fonts.
 *
 * These are imported once at the application root (`app/layout.tsx`) so that
 * Next.js loads the font files and exposes them via CSS custom properties on
 * `<html>`. The `ClassicTemplate` component then selects which family to use
 * by setting `--resume-font` on the `.resume-document` root.
 *
 * The component reads the font name (e.g. "Inter") through `--resume-font`,
 * NOT through these Tailwind variables — that lets it render via
 * `react-dom/server.renderToStaticMarkup` without needing Tailwind. The
 * Tailwind classes are exposed for future ad-hoc usage.
 *
 * NOTE: `next/font/google` analyzes call sites statically at build time, so
 * the `weight`/`subsets` arrays below MUST be written as object literals at
 * the call site — no spreads, no shared constants. This is enforced by the
 * Next.js loader.
 */
import {
  Inter,
  Roboto,
  Open_Sans,
  Lato,
  Source_Sans_3,
} from "next/font/google";

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-resume-inter",
});

export const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-resume-roboto",
});

export const openSans = Open_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-resume-open-sans",
});

// Lato ships only 100/300/400/700/900 on Google Fonts. The resume's typo
// scale uses 400/500/600/700; the CSS `font-weight: 600` request will round
// to the nearest available weight (700) when Lato is selected. This is an
// intentional, documented compromise — the spec acknowledges that the 5
// fonts have differing weight inventories and accepts visual drift here.
export const lato = Lato({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "700"],
  variable: "--font-resume-lato",
});

// Source Sans Pro was renamed to Source Sans 3 on Google Fonts; this is the
// modern, identical drop-in. We keep the public-facing name "Source Sans Pro"
// in the ResumeFont union to match the spec.
export const sourceSansPro = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-resume-source-sans-pro",
});

/**
 * The 5 supported resume fonts. The string values are the names used inside
 * the `font-family` CSS declaration set by `ClassicTemplate` via
 * `--resume-font`, so they must match the actual font family Google ships.
 */
export type ResumeFont =
  | "Inter"
  | "Roboto"
  | "Open Sans"
  | "Lato"
  | "Source Sans Pro";

export const RESUME_FONTS: readonly ResumeFont[] = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Source Sans Pro",
] as const;

/**
 * Concatenated `next/font` className containing every resume font's CSS
 * variable. Apply this once on a high-level wrapper (e.g. `<html>` or the
 * dashboard layout) so the variables are available to any descendant.
 */
export const allResumeFontVariables = [
  inter.variable,
  roboto.variable,
  openSans.variable,
  lato.variable,
  sourceSansPro.variable,
].join(" ");

/**
 * Returns the `next/font` className for the given font. Useful when you want
 * to scope a single font's variable to a subtree rather than loading all five
 * globally. The application layout already injects all variables, so this
 * helper is rarely needed in practice — it exists per the TAILOR-5 spec.
 */
export function getResumeFontVariableClass(font: ResumeFont): string {
  switch (font) {
    case "Inter":
      return inter.variable;
    case "Roboto":
      return roboto.variable;
    case "Open Sans":
      return openSans.variable;
    case "Lato":
      return lato.variable;
    case "Source Sans Pro":
      return sourceSansPro.variable;
  }
}

/**
 * The CSS `font-family` cascade for a given resume font, ready to drop into
 * an inline style as `--resume-font`. Includes the same system fallback as
 * the spec's `.resume-document` rule.
 */
export function getResumeFontFamily(font: ResumeFont): string {
  return `"${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}
