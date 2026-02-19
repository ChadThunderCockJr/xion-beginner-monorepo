import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0E08",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#7A1830",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            display: "flex",
          }}
        >
          G
        </div>
      </div>
    ),
    { ...size },
  );
}
