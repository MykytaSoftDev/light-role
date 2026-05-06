"""Singleton Chromium-backed PDF renderer (TAILOR-3).

This module owns the lifecycle of a single Playwright `Browser` instance
that stays warm between requests. Cold-launching Chromium per render adds
~800ms-1.5s of overhead and burns CPU; keeping it warm gets us the
PRD-target 1-3s typical render time after the first request.

Library choice — Playwright (Python):
  - Actively maintained by Microsoft; first-class async API.
  - `playwright install chromium` is a single deterministic command,
    pinned by the playwright wheel version.
  - Pyppeteer is unmaintained (last release 2022) and binds against
    older Chromium revisions with known leaks under asyncio.

Concurrency model:
  - One `Browser` shared across requests; each render gets its own
    `BrowserContext` + `Page` that are closed when done. Contexts are
    cheap (~10ms) and provide isolation — cookies/storage from one
    render can't pollute another.
  - `_startup_lock` guards lazy startup so concurrent first requests
    don't double-launch Chromium.
  - `_render_count` + `_recycle_lock` enforce the recycle policy from
    `settings.pdf_browser_recycle_after`. After N successful renders the
    browser is closed and re-launched on the next request.

Failure modes:
  - Chromium fails to launch: lifespan hook logs and continues; first
    render attempt re-tries (lazy launch). This way a Chromium hiccup
    at startup doesn't crash the whole API.
  - `page.pdf()` exceeds `pdf_render_timeout_seconds`: raises
    `PDFRenderTimeout` — the router maps this to HTTP 504.
  - Anything else: raises `PDFRenderError` → HTTP 500.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Optional

from app.config import settings

# Playwright is imported lazily inside `_launch_locked()` so the module can
# be imported in environments where the wheel is unavailable (e.g., the
# project venv on a developer machine). Importing this module does NOT
# require playwright to be installed; calling `start()` / `render_pdf()`
# does. The 404 / auth tests can run without Chromium present.
if TYPE_CHECKING:  # pragma: no cover
    from playwright.async_api import Browser, Playwright

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Typed exceptions — the router relies on these to choose 504 vs 500.
# ---------------------------------------------------------------------------


class PDFRenderError(Exception):
    """Generic PDF render failure (Chromium crashed, navigation failed, ...)."""


class PDFRenderTimeout(PDFRenderError):
    """`page.pdf()` or `set_content()` blew past the configured timeout."""


# ---------------------------------------------------------------------------
# Singleton state
# ---------------------------------------------------------------------------
# Module-level singletons — never construct a second PDFService. The lifespan
# hook in app/main.py calls `start()` / `stop()` against this single instance.


class _PDFService:
    """Internal singleton. Use the module-level `pdf_service` instance."""

    def __init__(self) -> None:
        # `Playwright` and `Browser` are stringified because the imports
        # are TYPE_CHECKING-guarded — see module docstring.
        self._playwright: Optional["Playwright"] = None
        self._browser: Optional["Browser"] = None
        # Guards lazy startup AND the recycle relaunch path. Held briefly.
        self._startup_lock = asyncio.Lock()
        # Successful renders since last (re)launch. Reset on recycle.
        self._render_count = 0
        # If True, `start()` failed at lifespan time — first render attempt
        # will retry. Distinct from `_browser is None` so we can log clearly.
        self._startup_failed = False

    # ---- lifecycle ----

    async def start(self) -> None:
        """Launch Chromium. Called from the FastAPI lifespan hook.

        Failures are logged and swallowed — the API must come up even if
        Chromium is broken. The first render attempt will retry-launch
        via `_ensure_browser()`.
        """
        try:
            await self._launch_locked()
            logger.info("PDF service: Chromium launched successfully")
        except Exception as exc:  # noqa: BLE001 — defensive, see docstring
            self._startup_failed = True
            logger.error(
                "PDF service: failed to launch Chromium at startup; "
                "rendering will retry on first request: %s",
                exc,
            )

    async def stop(self) -> None:
        """Gracefully tear down Chromium + Playwright. Idempotent."""
        async with self._startup_lock:
            await self._teardown_locked()
        logger.info("PDF service: Chromium stopped")

    # ---- public render API ----

    async def render_pdf(
        self,
        html: str,
        *,
        format: str = "A4",
        margin_mm: int = 15,
    ) -> bytes:
        """Render `html` to a PDF byte string.

        Args:
            html: A complete HTML document (`<html><head>...</head>
                <body>...</body></html>`). Caller is responsible for
                inlining CSS and any `@font-face` declarations.
            format: Paper size passed straight to Playwright. Default A4
                matches PRD 3.4.B.7.
            margin_mm: Uniform page margin in millimetres on all sides.

        Returns:
            Raw PDF bytes. Caller wraps in StreamingResponse.

        Raises:
            PDFRenderTimeout: render exceeded `pdf_render_timeout_seconds`.
            PDFRenderError: any other Chromium / Playwright failure.
        """
        # Local import keeps this module importable when playwright isn't
        # installed (dev environments without the Docker image).
        from playwright.async_api import (  # noqa: WPS433
            TimeoutError as PlaywrightTimeoutError,
        )

        await self._ensure_browser()
        assert self._browser is not None  # for type checker

        timeout_ms = settings.pdf_render_timeout_seconds * 1000
        context = None
        page = None
        try:
            # Fresh isolated context per request — keeps cookies/local
            # storage from leaking across renders if we ever load real URLs.
            context = await self._browser.new_context()
            page = await context.new_page()

            # `wait_until="networkidle"` makes Chromium wait for in-flight
            # font / image fetches to settle before we snap the PDF.
            # `set_content` accepts inline HTML — no `goto()` needed.
            await page.set_content(
                html,
                wait_until="networkidle",
                timeout=timeout_ms,
            )

            margin = f"{margin_mm}mm"
            pdf_bytes: bytes = await page.pdf(
                format=format,
                margin={
                    "top": margin,
                    "right": margin,
                    "bottom": margin,
                    "left": margin,
                },
                print_background=True,
                # `prefer_css_page_size=False` so `format` always wins over
                # any stray @page rules in the resume CSS.
                prefer_css_page_size=False,
            )
        except PlaywrightTimeoutError as exc:
            logger.warning("PDF render timeout after %ds", settings.pdf_render_timeout_seconds)
            raise PDFRenderTimeout(
                f"PDF render exceeded {settings.pdf_render_timeout_seconds}s"
            ) from exc
        except Exception as exc:
            logger.error("PDF render error: %s", exc, exc_info=True)
            raise PDFRenderError(str(exc)) from exc
        finally:
            # Best-effort cleanup. If Chromium has already crashed these
            # will themselves raise — swallow because the request is over.
            if page is not None:
                try:
                    await page.close()
                except Exception:  # noqa: BLE001
                    pass
            if context is not None:
                try:
                    await context.close()
                except Exception:  # noqa: BLE001
                    pass

        # Successful render — update counter and recycle if we hit the cap.
        await self._post_render()
        return pdf_bytes

    # ---- internals ----

    async def _ensure_browser(self) -> None:
        """Lazy-launch / re-launch Chromium if needed.

        Triggered by:
          - `start()` failed at lifespan time (`_startup_failed`).
          - Browser was closed by the recycle policy.
          - Browser crashed and `is_connected()` returned False.
        """
        if self._browser is not None and self._browser.is_connected():
            return

        async with self._startup_lock:
            # Re-check under lock — another coroutine may have launched.
            if self._browser is not None and self._browser.is_connected():
                return

            # Tear down any half-dead state first.
            await self._teardown_locked()
            try:
                await self._launch_locked()
            except Exception as exc:
                # Surface as a render error so the caller returns 500.
                logger.error("PDF service: lazy launch failed: %s", exc)
                raise PDFRenderError(
                    "PDF rendering is unavailable (Chromium failed to launch)."
                ) from exc

    async def _launch_locked(self) -> None:
        """Caller MUST hold `_startup_lock`. Launches a fresh browser."""
        # Local import — see docstring at top of module.
        from playwright.async_api import async_playwright  # noqa: WPS433

        self._playwright = await async_playwright().start()
        # `--no-sandbox` is required when running as root in slim Docker
        # images. We rely on container-level isolation instead. If the
        # entrypoint switches to a non-root user, this flag is still safe
        # to keep (Chromium just no-ops).
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",  # avoid /dev/shm OOM in containers
                "--disable-gpu",
            ],
        )
        self._render_count = 0
        self._startup_failed = False

    async def _teardown_locked(self) -> None:
        """Caller MUST hold `_startup_lock`. Closes browser + Playwright."""
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:  # noqa: BLE001
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:  # noqa: BLE001
                pass
            self._playwright = None

    async def _post_render(self) -> None:
        """Bump render count; recycle if we've hit the configured threshold."""
        self._render_count += 1
        recycle_after = settings.pdf_browser_recycle_after
        if recycle_after > 0 and self._render_count >= recycle_after:
            logger.info(
                "PDF service: recycling browser after %d renders",
                self._render_count,
            )
            async with self._startup_lock:
                await self._teardown_locked()
                # Don't re-launch eagerly — `_ensure_browser()` will do it
                # on the next request. Saves resources during quiet periods.


# Module-level singleton — import this, don't construct another.
pdf_service = _PDFService()
