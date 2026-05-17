import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PRIMARY_HEX = "#5FA90E";
const FOREGROUND_HEX = "#0A0A0A";
const BACKGROUND_HEX = "#FFFFFF";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BACKGROUND_HEX,
        }}
      >
        <svg width="126" height="126" viewBox="0 0 200 200" fill="none">
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
      </div>
    ),
    size,
  );
}
