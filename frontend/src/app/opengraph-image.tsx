import { ImageResponse } from "next/og";

export const alt = "Light Role: AI resume tailoring and job application tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PRIMARY_HEX = "#5FA90E";
const BACKGROUND_HEX = "#FFFFFF";
const FOREGROUND_HEX = "#0A0A0A";

export default async function OgImage() {
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
          <svg width="60" height="60" viewBox="0 0 200 200" fill="none">
            <path
              d="M 60 32 L 32 32 L 32 168 L 60 168"
              stroke={PRIMARY_HEX}
              strokeWidth="16"
              fill="none"
            />
            <path
              d="M 140 32 L 168 32 L 168 168 L 140 168"
              stroke={PRIMARY_HEX}
              strokeWidth="16"
              fill="none"
            />
            <path
              d="M 80 52 L 80 148 L 132 148"
              stroke={FOREGROUND_HEX}
              strokeWidth="18"
              strokeLinejoin="miter"
              fill="none"
            />
          </svg>
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
              fontSize: 80,
              fontWeight: 700,
              color: FOREGROUND_HEX,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            <span>Stop rewriting your resume.</span>
            <span style={{ color: PRIMARY_HEX }}>Start landing them.</span>
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
    size,
  );
}
