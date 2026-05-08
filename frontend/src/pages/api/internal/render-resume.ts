/**
 * TAILOR-4 — Internal Resume Render API (Pages Router)
 *
 * Server-renders `<ClassicTemplate />` to static HTML so the backend's
 * Playwright-based PDF pipeline (`backend/app/services/pdf_service.py`) can
 * use the exact same React component as the live editor preview.
 *
 * Why Pages Router (not App Router)
 * ---------------------------------
 *   Next.js 16's bundler applies the `react-server` export condition to ALL
 *   App Router files (including Route Handlers, despite them not being
 *   Server Components). Under that condition, `react-dom/server` resolves to
 *   a stub that throws at import time. Even a dynamic `import()` doesn't
 *   help — the issue is at module resolution, not at the import call site.
 *
 *   The Pages Router (`pages/api/*`) is pure Node, with no RSC condition
 *   applied, so we can do a plain top-level static import of
 *   `react-dom/server` and call `renderToStaticMarkup` normally.
 *
 *   The URL `/api/internal/render-resume` is unchanged — Pages Router takes
 *   over routing for it, so the backend client needs no changes.
 *
 * Trust model
 * ----------
 *   - Internal-only. Gated by `X-Internal-Secret` header == server-only env
 *     `INTERNAL_RENDER_SECRET`.
 *   - Secret MUST NOT be `NEXT_PUBLIC_*` (would ship to the browser).
 *   - If env unset: 503 (refuse rather than silently disabling auth).
 *   - Comparison is constant-time (`crypto.timingSafeEqual`) and
 *     length-checked, with a dummy compare on length mismatch so neither
 *     length nor content can be probed via timing.
 *
 * Output contract
 * ---------------
 *   Body is the raw `renderToStaticMarkup(<ClassicTemplate ... />)` output:
 *   a `<div class="resume-document">…<style>…</style>…</div>` tree, no
 *   `<html>`/`<head>`/`<body>` wrapper. The backend wraps it before handing
 *   to Playwright. We use `renderToStaticMarkup` (NOT `renderToString`) so
 *   React doesn't emit hydration data attributes that would bloat the PDF.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "node:crypto";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ClassicTemplate } from "@/components/resume/classic-template";
import type { ProfileData } from "@/lib/profile-api";
import { RESUME_FONTS, type ResumeFont } from "@/lib/fonts/resume-fonts";

interface RenderRequestBody {
  data: ProfileData;
  font: ResumeFont;
  sections_order: string[];
  template: "classic";
  today?: string;
}

/**
 * Constant-time comparison that also resists length-based timing leaks.
 *
 * `timingSafeEqual` requires equal-length buffers, so we must guard the call
 * with a length check — but a naive length check would short-circuit on
 * mismatch and leak (via timing) that the lengths differ. To prevent that,
 * on a length mismatch we still run a `timingSafeEqual` against a dummy
 * buffer so the response time is comparable to the success path.
 */
function secretsEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    // Compare provided to itself so we still pay the full cost; result is
    // discarded — the length mismatch alone disqualifies the request.
    timingSafeEqual(providedBuf, providedBuf);
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

function badRequest(res: NextApiResponse, message: string): void {
  res.status(400).json({ error: message });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // ---- Method gate --------------------------------------------------------
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  // ---- Auth gate ----------------------------------------------------------
  const expectedSecret = process.env.INTERNAL_RENDER_SECRET;
  if (!expectedSecret || expectedSecret.length === 0) {
    // Misconfigured deploy — refuse rather than silently disabling auth.
    res.status(503).json({ error: "render endpoint not configured" });
    return;
  }
  const rawProvided = req.headers["x-internal-secret"];
  // `headers[name]` can be `string | string[] | undefined`. We only accept
  // a single string value — duplicate headers are suspicious here.
  const providedSecret =
    typeof rawProvided === "string" ? rawProvided : "";
  if (!providedSecret || !secretsEqual(providedSecret, expectedSecret)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // ---- Validate content type ---------------------------------------------
  // Pages API auto-parses JSON when Content-Type is application/json. We
  // still check the header explicitly so callers that forget the header
  // get a clear 400 instead of a confusing "body must be an object" later.
  const contentType =
    (req.headers["content-type"] ?? "").toString().toLowerCase();
  if (!contentType.includes("application/json")) {
    badRequest(res, "content-type must be application/json");
    return;
  }

  // ---- Validate body -----------------------------------------------------
  const body: unknown = req.body;
  if (!body || typeof body !== "object") {
    badRequest(res, "body must be an object");
    return;
  }
  const b = body as Record<string, unknown>;

  if (b.template !== "classic") {
    badRequest(res, "template must be 'classic'");
    return;
  }
  if (typeof b.font !== "string" || !RESUME_FONTS.includes(b.font as ResumeFont)) {
    badRequest(res, "invalid font");
    return;
  }
  if (
    !Array.isArray(b.sections_order) ||
    !b.sections_order.every((k) => typeof k === "string")
  ) {
    badRequest(res, "sections_order must be an array of strings");
    return;
  }
  if (!b.data || typeof b.data !== "object") {
    badRequest(res, "data must be an object");
    return;
  }
  if (b.today !== undefined && typeof b.today !== "string") {
    badRequest(res, "today must be a string when provided");
    return;
  }

  // We've validated the shape just enough; ClassicTemplate itself is
  // forgiving about missing nested fields, per the spec.
  const payload = b as unknown as RenderRequestBody;

  // ---- Render ------------------------------------------------------------
  let html: string;
  try {
    html = renderToStaticMarkup(
      React.createElement(ClassicTemplate, {
        data: payload.data,
        font: payload.font,
        sections_order: payload.sections_order,
        template: "classic",
        today: payload.today,
      }),
    );
  } catch (err) {
    // Don't leak component internals; backend will surface a generic error.
    console.error("[render-resume] render failed:", err);
    res.status(500).json({ error: "render failed" });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}

// Pages API defaults the body parser to a 1 MB limit. Resume payloads
// (rich profile data + sections) can plausibly approach that under heavy
// content, so raise to 5 MB to leave headroom.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};
