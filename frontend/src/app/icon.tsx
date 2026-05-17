import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const PRIMARY_HEX = "#5FA90E";
const FOREGROUND_HEX = "#0A0A0A";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
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
