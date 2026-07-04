import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Satori (next/og) cannot parse oklch() or var() — OG images must use plain HEX.
const PRIMARY_HEX = "#5FA90E";
const BACKGROUND_HEX = "#FFFFFF";
const FOREGROUND_HEX = "#0A0A0A";

/** Shared OG/Twitter image dimensions for every product page. */
export const OG_SIZE = { width: 1200, height: 630 };

interface RenderFeatureOgArgs {
  line1: string;
  line2: string;
  /** Optional explicit headline font size (px). Auto-computed when omitted. */
  fontSize?: number;
}

/**
 * Auto-shrinks the headline so the longest line fits within the ~1040px content
 * width (1200 − 2×80 padding) at bold weight. Long accent lines (e.g. the
 * cover-letters page) drop to 64px gracefully.
 */
function resolveFontSize(line1: string, line2: string): number {
  const maxLen = Math.max(line1.length, line2.length);
  if (maxLen <= 22) return 80;
  if (maxLen <= 28) return 70;
  return 64;
}

/**
 * Renders a product-page OG image replicating src/app/opengraph-image.tsx:
 * logo row (icon + "Light Role") and a two-line headline with the accent line
 * in the brand green, plus the primary underline bar.
 */
export async function renderFeatureOg({
  line1,
  line2,
  fontSize,
}: RenderFeatureOgArgs): Promise<ImageResponse> {
  const logoData = await readFile(
    join(process.cwd(), "public/assets/logo/lightrole-icon-512.png"),
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  const headlineSize = fontSize ?? resolveFontSize(line1, line2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BACKGROUND_HEX,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={60} height={60} alt="" />
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: FOREGROUND_HEX,
              letterSpacing: "-0.02em",
            }}
          >
            Light Role
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: headlineSize,
              fontWeight: 700,
              color: FOREGROUND_HEX,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            <span>{line1}</span>
            <span style={{ color: PRIMARY_HEX }}>{line2}</span>
          </div>
          <div
            style={{
              width: "120px",
              height: "6px",
              background: PRIMARY_HEX,
              marginTop: "12px",
            }}
          />
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
