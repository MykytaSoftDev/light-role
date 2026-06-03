# syntax=docker/dockerfile:1.7
#
# Light Role backend image.
#
# Multi-stage build:
#   1. `python-deps`  — install Python wheels (cached separately so app code
#                       changes don't bust the heavy pip layer).
#   2. `runtime`      — final image with Chromium (Playwright) + 5 bundled
#                       fonts for PDF rendering (TAILOR-3 / TAILOR-5).
#
# Image size note: bundling Chromium adds ~200MB. This is intentional — see
# TAILOR-3 in docs/v2/tasks-resume-tailor.json. PDF rendering needs a real
# browser engine for accurate typography, page breaks, and CSS support that
# fpdf2/weasyprint can't match for our resume template.

# ---------------------------------------------------------------------------
# Stage 1 — Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS python-deps

WORKDIR /app

# Build deps for psycopg2 + general C extensions; kept out of the final image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# ---------------------------------------------------------------------------
# Stage 2 — Runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

WORKDIR /app

# Pin the Playwright browser revision via env so re-builds are deterministic.
# Playwright stores Chromium under /ms-playwright (system-wide).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Runtime system deps.
#   - libpq5: psycopg2 needs libpq.so at runtime.
#   - curl:   used by the font-download step below + healthchecks.
#   - ca-certificates: TLS for Google Fonts download + outbound HTTPS.
#   - fontconfig: required by Chromium to enumerate our bundled fonts.
#
# Chromium headless deps (verified against Playwright 1.49 docs, Debian 12).
# Keep this list minimal — adding kitchen-sink deps bloats the image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
        ca-certificates \
        fontconfig \
        # --- Chromium runtime ---
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
        libatspi2.0-0 \
        libdrm2 \
        # Liberation fonts ship a baseline so Chromium never falls back to
        # an empty glyph set if our @font-face URL fails to load.
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Pull pre-built Python wheels from the deps stage.
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Install Chromium for Playwright. `--with-deps` would re-install system libs
# we already curated above — using the deps-less variant keeps the image lean.
# Chromium revision is whatever `playwright==<pinned>` ships with (see
# requirements.txt). Re-pinning playwright re-pins the browser.
#
# Runs as root → Chromium lands under /ms-playwright owned by root. We chown it
# to appuser further down (after the user exists) so the non-root runtime can
# read+execute the browser binaries.
RUN playwright install chromium

# ---------------------------------------------------------------------------
# Bundled fonts (TAILOR-5)
# ---------------------------------------------------------------------------
# 5 OFL-licensed Google Fonts × 4 weights (400/500/600/700) downloaded at
# build time, never vendored in git. URLs point at the official google/fonts
# GitHub repo (raw.githubusercontent.com) which serves the .ttf binaries with
# stable paths.
#
# We download .ttf (not .woff2) because the google/fonts repo ships .ttf as
# the canonical source. Chromium handles .ttf via @font-face just fine and
# fontconfig (used by `fc-list`) only recognises .ttf/.otf — so this also
# makes the fonts available system-wide for any rendering path.
#
# Fonts are placed at /app/fonts/<family>/<weight>.ttf and ALSO symlinked
# into /usr/share/fonts/truetype/lightrole so fontconfig picks them up
# (verifiable via `fc-list | grep -i inter`).
RUN mkdir -p /app/fonts \
    && set -eux; \
    GFONTS_BASE="https://raw.githubusercontent.com/google/fonts/main/ofl"; \
    \
    # Inter (default)
    mkdir -p /app/fonts/inter; \
    curl -fsSL "${GFONTS_BASE}/inter/Inter%5Bopsz%2Cwght%5D.ttf" -o /app/fonts/inter/Inter-VF.ttf; \
    \
    # Roboto (variable font)
    mkdir -p /app/fonts/roboto; \
    curl -fsSL "${GFONTS_BASE}/roboto/Roboto%5Bwdth%2Cwght%5D.ttf" -o /app/fonts/roboto/Roboto-VF.ttf; \
    \
    # Open Sans (variable font)
    mkdir -p /app/fonts/opensans; \
    curl -fsSL "${GFONTS_BASE}/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf" -o /app/fonts/opensans/OpenSans-VF.ttf; \
    \
    # Lato — static weights only (no variable font in google/fonts)
    mkdir -p /app/fonts/lato; \
    curl -fsSL "${GFONTS_BASE}/lato/Lato-Regular.ttf"  -o /app/fonts/lato/Lato-400.ttf; \
    curl -fsSL "${GFONTS_BASE}/lato/Lato-Bold.ttf"     -o /app/fonts/lato/Lato-700.ttf; \
    # Lato has no 500/600 in the repo — we map them to 400/700 in font_css.py.
    \
    # Source Sans Pro / Source Sans 3 (variable font)
    mkdir -p /app/fonts/sourcesans; \
    curl -fsSL "${GFONTS_BASE}/sourcesans3/SourceSans3%5Bwght%5D.ttf" -o /app/fonts/sourcesans/SourceSans3-VF.ttf; \
    \
    # Register fonts with fontconfig so Chromium / fc-list can find them.
    mkdir -p /usr/share/fonts/truetype/lightrole; \
    cp -r /app/fonts/* /usr/share/fonts/truetype/lightrole/; \
    fc-cache -f -v > /dev/null

# ---------------------------------------------------------------------------
# Non-root runtime user (security hardening)
# ---------------------------------------------------------------------------
# Mirror the frontend image: dedicated appuser/appgroup at uid/gid 1001.
#
# Everything above this point needs root (apt-get, playwright install,
# fc-cache, font downloads) — so we create the user and fix ownership AFTER
# all root-privileged work, then drop privileges with `USER appuser` below.
#
# Named-volume permission note: /uploads and /app/logs are mounted as Docker
# named volumes at runtime. When a named volume is first mounted onto a path,
# Docker seeds the volume with the IMAGE's ownership of that mountpoint. So we
# must create these dirs and chown them to appuser *in the image* — otherwise
# the volumes would be created owned by root and the non-root process could not
# write resume uploads or logs.
RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup --no-create-home appuser \
    && mkdir -p /uploads /app/logs /app/fonts \
    && chown -R appuser:appgroup /app /uploads /ms-playwright

# ---------------------------------------------------------------------------
# App code
# ---------------------------------------------------------------------------
# Copy app code already owned by appuser so the running process can read it
# (and so entrypoint.sh is owned by the user that executes it).
COPY --chown=appuser:appgroup . .

# entrypoint.sh must be executable by appuser (it runs `alembic upgrade head`
# then uvicorn). chmod here sets the owner-exec bit; the COPY above made
# appuser the owner.
RUN chmod +x entrypoint.sh

# Drop root. All subsequent layers + the runtime process run as appuser (1001).
USER appuser

EXPOSE 8000

CMD ["./entrypoint.sh"]
