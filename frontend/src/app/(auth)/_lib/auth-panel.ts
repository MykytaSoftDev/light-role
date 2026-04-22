/**
 * Shared gradient for the auth pages' left branding panel.
 *
 * Uses OKLCH values aligned with the app's green palette (hue 120).
 * The panel is wrapped in a `dark` className so the panel content can
 * consume `bg-primary`, `text-muted-foreground`, etc. tokens from the
 * dark-mode theme variables in globals.css.
 *
 * Structure:
 *   radial-gradient(...) layered over a solid near-black base — three
 *   OKLCH color stops in the radial, then the base color.
 */
export const AUTH_PANEL_GRADIENT = `
  radial-gradient(ellipse 95% 65% at 50% -15%, oklch(60% 0.22 120 / 0.38) 0%, transparent 55%),
  radial-gradient(ellipse 55% 45% at 15% 95%, oklch(55% 0.2 130 / 0.22) 0%, transparent 60%),
  radial-gradient(ellipse 40% 30% at 90% 40%, oklch(75% 0.18 125 / 0.12) 0%, transparent 65%),
  oklch(14% 0.02 140)
`;
