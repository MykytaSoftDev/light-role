"""Font CSS helpers for server-side resume rendering (TAILOR-5).

The contract: the resume HTML builder asks this module for a `@font-face`
CSS string for the chosen font family, and embeds it in the HTML's `<style>`
block. Chromium (via Playwright in `pdf_service.py`) then resolves the
`url(...)` references against the local Docker image filesystem.

Why we serve the fonts via a FastAPI `StaticFiles` mount (`/static/fonts/...`)
and NOT `file:///app/fonts/...`:
  - Chromium blocks `file://` URLs from documents loaded over `data:` /
    `about:blank` for security. `setContent()` uses `about:blank` as the
    base URL, so `file://` references silently 404.
  - Loading via HTTP from the same origin (the FastAPI app) sidesteps this
    entirely and matches how the browser preview will load the same fonts
    in production (next/font emits HTTP URLs too — visual parity).

The 5 supported families correspond to the assets bundled in `Dockerfile`.
Each family resolves to one or more on-disk .ttf files at /app/fonts/.
"""

from __future__ import annotations

from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Font catalog
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _FontFile:
    """A single @font-face declaration source.

    `path` is the URL path relative to the FastAPI StaticFiles mount
    (`/static/fonts/...`) — NOT a filesystem path. The runtime mount in
    `app/main.py` maps `/static/fonts` to `/app/fonts` inside the container.
    """

    weight: int
    path: str


# Per-family font file map. Keys are the canonical font_snapshot values
# (matching what the AI / preferences write into TailoredResume.font_snapshot).
#
# For variable fonts (Inter, Roboto, Open Sans, Source Sans 3) we point all
# weights at the same VF file — Chromium picks the right axis. For Lato we
# only have static 400 + 700 in the google/fonts repo, so 500/600 fall back
# to 400 / 700 respectively (close enough for resumes; user-visible diff is
# negligible).
_CATALOG: dict[str, list[_FontFile]] = {
    "Inter": [
        _FontFile(weight=400, path="/static/fonts/inter/Inter-VF.ttf"),
        _FontFile(weight=500, path="/static/fonts/inter/Inter-VF.ttf"),
        _FontFile(weight=600, path="/static/fonts/inter/Inter-VF.ttf"),
        _FontFile(weight=700, path="/static/fonts/inter/Inter-VF.ttf"),
    ],
    "Roboto": [
        _FontFile(weight=400, path="/static/fonts/roboto/Roboto-VF.ttf"),
        _FontFile(weight=500, path="/static/fonts/roboto/Roboto-VF.ttf"),
        _FontFile(weight=600, path="/static/fonts/roboto/Roboto-VF.ttf"),
        _FontFile(weight=700, path="/static/fonts/roboto/Roboto-VF.ttf"),
    ],
    "Open Sans": [
        _FontFile(weight=400, path="/static/fonts/opensans/OpenSans-VF.ttf"),
        _FontFile(weight=500, path="/static/fonts/opensans/OpenSans-VF.ttf"),
        _FontFile(weight=600, path="/static/fonts/opensans/OpenSans-VF.ttf"),
        _FontFile(weight=700, path="/static/fonts/opensans/OpenSans-VF.ttf"),
    ],
    "Lato": [
        _FontFile(weight=400, path="/static/fonts/lato/Lato-400.ttf"),
        # 500/600 don't exist in google/fonts/Lato — alias to 400/700.
        _FontFile(weight=500, path="/static/fonts/lato/Lato-400.ttf"),
        _FontFile(weight=600, path="/static/fonts/lato/Lato-700.ttf"),
        _FontFile(weight=700, path="/static/fonts/lato/Lato-700.ttf"),
    ],
    "Source Sans Pro": [
        _FontFile(weight=400, path="/static/fonts/sourcesans/SourceSans3-VF.ttf"),
        _FontFile(weight=500, path="/static/fonts/sourcesans/SourceSans3-VF.ttf"),
        _FontFile(weight=600, path="/static/fonts/sourcesans/SourceSans3-VF.ttf"),
        _FontFile(weight=700, path="/static/fonts/sourcesans/SourceSans3-VF.ttf"),
    ],
}

DEFAULT_FONT = "Inter"

# Public list of supported families — matches the 5 next/font choices on
# the frontend so the editor's font dropdown stays in sync with what the
# PDF pipeline can render.
SUPPORTED_FONTS: tuple[str, ...] = tuple(_CATALOG.keys())


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_font_face_css(font_family: str, *, base_url: str = "") -> str:
    """Build the `@font-face` block for the given family.

    Args:
        font_family: One of `SUPPORTED_FONTS`. Unknown values fall back to
            `DEFAULT_FONT` rather than raising — the resume must always
            render, even if a stale snapshot references a retired font.
        base_url: Optional absolute origin to prefix on each `url(...)`
            reference (e.g., "http://localhost:8000"). Empty by default,
            which produces relative-rooted URLs ("/static/fonts/...") that
            resolve correctly when the rendered HTML is served from the
            same origin. Pass an explicit base when handing the HTML to
            Playwright via `page.set_content()` because `about:blank`
            cannot resolve site-relative paths.

    Returns:
        A CSS string with one `@font-face` rule per weight. Always ends
        with a trailing newline so callers can concatenate freely.
    """
    family = font_family if font_family in _CATALOG else DEFAULT_FONT
    entries = _CATALOG[family]

    rules: list[str] = []
    for entry in entries:
        url = f"{base_url}{entry.path}"
        rules.append(
            "@font-face {\n"
            f"  font-family: '{family}';\n"
            f"  src: url('{url}') format('truetype');\n"
            f"  font-weight: {entry.weight};\n"
            "  font-style: normal;\n"
            "  font-display: swap;\n"
            "}"
        )
    return "\n".join(rules) + "\n"


def get_default_font_stack(font_family: str) -> str:
    """Build a `font-family: ...` value with system fallbacks.

    The trailing fallback chain matches the browser-side next/font default
    so the PDF doesn't render with a wildly different fallback if the
    @font-face fails to load (e.g., during a Chromium font-cache miss).
    """
    family = font_family if font_family in _CATALOG else DEFAULT_FONT
    return (
        f"'{family}', "
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif"
    )
