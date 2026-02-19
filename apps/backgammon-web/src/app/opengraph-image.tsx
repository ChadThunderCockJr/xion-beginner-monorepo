import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gammon — The world's fairest backgammon platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0E08 0%, #1A2818 50%, #0A0E08 100%)",
          fontFamily: "Georgia, serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: "absolute",
            inset: 20,
            border: "2px solid rgba(122, 24, 48, 0.4)",
            borderRadius: 24,
            display: "flex",
          }}
        />

        {/* Subtle board pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.08,
          }}
        >
          <svg width="400" height="300" viewBox="0 0 400 300">
            <rect x="10" y="10" width="380" height="280" rx="8" stroke="#7A1830" strokeWidth="2" fill="none" />
            <line x1="200" y1="10" x2="200" y2="290" stroke="#7A1830" strokeWidth="1" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <polygon
                key={`t${i}`}
                points={`${20 + i * 30},15 ${35 + i * 30},100 ${50 + i * 30},15`}
                fill={i % 2 === 0 ? "#7A1830" : "#3A0C1A"}
              />
            ))}
          </svg>
        </div>

        {/* Dice icon */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="2" y="2" width="60" height="60" rx="12" stroke="#7A1830" strokeWidth="2.5" fill="none" />
            <circle cx="22" cy="22" r="4" fill="#7A1830" />
            <circle cx="42" cy="22" r="4" fill="#7A1830" />
            <circle cx="32" cy="32" r="4" fill="#7A1830" />
            <circle cx="22" cy="42" r="4" fill="#7A1830" />
            <circle cx="42" cy="42" r="4" fill="#7A1830" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: "#ECE8E0",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginBottom: 16,
            display: "flex",
          }}
        >
          Gammon
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#B0AAA0",
            lineHeight: 1.4,
            textAlign: "center",
            maxWidth: 600,
            display: "flex",
          }}
        >
          The world&apos;s fairest backgammon platform
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["Provably Fair", "USDC Wagering", "On-Chain Verified"].map(
            (feat) => (
              <div
                key={feat}
                style={{
                  padding: "8px 20px",
                  borderRadius: 20,
                  border: "1px solid rgba(122, 24, 48, 0.6)",
                  fontSize: 16,
                  color: "#B0AAA0",
                  fontWeight: 500,
                  display: "flex",
                }}
              >
                {feat}
              </div>
            ),
          )}
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            fontSize: 18,
            color: "rgba(176, 170, 160, 0.5)",
            display: "flex",
          }}
        >
          gammon.nyc
        </div>
      </div>
    ),
    { ...size },
  );
}
