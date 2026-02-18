"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/* ══════════════════════════════════════════════════════════════════
   Local Components
   ══════════════════════════════════════════════════════════════════ */

function GammonButton({
  children,
  onClick,
  disabled,
  style: s,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: "100%",
        padding: "14px 20px",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontFamily: "var(--font-body)",
        letterSpacing: "-0.01em",
        background: disabled
          ? "var(--color-bg-subtle)"
          : h
            ? "var(--color-gold-light)"
            : "var(--color-gold-primary)",
        color: disabled ? "var(--color-text-muted)" : "var(--color-accent-fg)",
        border: "none",
        boxShadow: h && !disabled ? "var(--shadow-gold)" : "none",
        opacity: disabled ? 0.6 : 1,
        ...s,
      }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Icons
   ══════════════════════════════════════════════════════════════════ */

function DiceLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="4" y="4" width="40" height="40" rx="8" stroke="var(--color-gold-primary)" strokeWidth="2.5" fill="none" />
      <circle cx="16" cy="16" r="3" fill="var(--color-gold-primary)" />
      <circle cx="32" cy="16" r="3" fill="var(--color-gold-primary)" />
      <circle cx="24" cy="24" r="3" fill="var(--color-gold-primary)" />
      <circle cx="16" cy="32" r="3" fill="var(--color-gold-primary)" />
      <circle cx="32" cy="32" r="3" fill="var(--color-gold-primary)" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Board Illustration SVG
   ══════════════════════════════════════════════════════════════════ */

function BoardIllustration() {
  // Bright enough to be visible on #040604 background
  const gold = "#A83858";
  const goldDark = "#6B2D3E";
  const burgundy = "#882040";
  const goldMuted = "#3A1828";
  const bgSubtle = "#4A4840";
  const bgElevated = "#1E241C";

  return (
    <svg
      width="260"
      height="180"
      viewBox="0 0 260 180"
      fill="none"
      style={{ opacity: 0.9 }}
    >
      {/* Board outline */}
      <rect
        x="10"
        y="10"
        width="240"
        height="160"
        rx="8"
        stroke={goldDark}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Center bar */}
      <line
        x1="130"
        y1="10"
        x2="130"
        y2="170"
        stroke={goldDark}
        strokeWidth="1"
      />
      {/* Top triangles (left) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <polygon
          key={`tl${i}`}
          points={`${18 + i * 19},15 ${28 + i * 19},60 ${38 + i * 19},15`}
          fill={i % 2 === 0 ? burgundy : goldMuted}
          stroke={bgSubtle}
          strokeWidth="0.5"
        />
      ))}
      {/* Top triangles (right) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <polygon
          key={`tr${i}`}
          points={`${138 + i * 19},15 ${148 + i * 19},60 ${158 + i * 19},15`}
          fill={i % 2 === 0 ? goldMuted : burgundy}
          stroke={bgSubtle}
          strokeWidth="0.5"
        />
      ))}
      {/* Bottom triangles (left) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <polygon
          key={`bl${i}`}
          points={`${18 + i * 19},165 ${28 + i * 19},120 ${38 + i * 19},165`}
          fill={i % 2 === 0 ? goldMuted : burgundy}
          stroke={bgSubtle}
          strokeWidth="0.5"
        />
      ))}
      {/* Bottom triangles (right) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <polygon
          key={`br${i}`}
          points={`${138 + i * 19},165 ${148 + i * 19},120 ${158 + i * 19},165`}
          fill={i % 2 === 0 ? burgundy : goldMuted}
          stroke={bgSubtle}
          strokeWidth="0.5"
        />
      ))}
      {/* White checkers */}
      {(
        [
          [28, 28],
          [28, 42],
          [148, 28],
          [148, 42],
          [148, 56],
        ] as [number, number][]
      ).map(([cx, cy], i) => (
        <circle
          key={`cw${i}`}
          cx={cx}
          cy={cy}
          r="8"
          fill={goldDark}
          stroke={gold}
          strokeWidth="0.5"
          opacity="0.6"
        />
      ))}
      {/* Dark checkers */}
      {(
        [
          [85, 152],
          [85, 138],
          [85, 124],
          [218, 152],
          [218, 138],
        ] as [number, number][]
      ).map(([cx, cy], i) => (
        <circle
          key={`cb${i}`}
          cx={cx}
          cy={cy}
          r="8"
          fill={burgundy}
          stroke="#882040"
          strokeWidth="0.5"
          opacity="0.6"
        />
      ))}
      {/* Dice */}
      <rect
        x="100"
        y="78"
        width="24"
        height="24"
        rx="4"
        fill={bgElevated}
        stroke={goldDark}
        strokeWidth="1"
      />
      <circle cx="107" cy="85" r="2" fill={gold} />
      <circle cx="117" cy="95" r="2" fill={gold} />
      <rect
        x="130"
        y="78"
        width="24"
        height="24"
        rx="4"
        fill={bgElevated}
        stroke={goldDark}
        strokeWidth="1"
      />
      <circle cx="137" cy="85" r="2" fill={gold} />
      <circle cx="147" cy="85" r="2" fill={gold} />
      <circle cx="137" cy="95" r="2" fill={gold} />
      <circle cx="147" cy="95" r="2" fill={gold} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN — Login Page
   ══════════════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const router = useRouter();
  const { isConnected, isConnecting, login } = useAuth();

  useEffect(() => {
    if (isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  return (
    <div
      className="flex flex-col lg:flex-row"
      style={{
        minHeight: "100dvh",
        fontFamily: "var(--font-body)",
        color: "var(--color-text-secondary)",
      }}
    >
      {/* ── Left: Branding Panel ── */}
      <div
        className="hidden lg:flex lg:flex-[0_0_45%]"
        style={{
          background: "#040604",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Geometric pattern background */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${(i * 9) % 100}%`,
                left: `${(i * 13 + 10) % 100}%`,
                width: 60 + (i * 17) % 40,
                height: 60 + (i * 17) % 40,
                borderRadius: i % 3 === 0 ? "50%" : 8,
                border: "2px solid #581428",
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: 380,
          }}
        >
          <BoardIllustration />

          <h2
            className="text-2xl lg:text-[32px]"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "#ECE8E0",
              margin: "32px 0 16px",
              lineHeight: 1.3,
            }}
          >
            Every roll verified.
            <br />
            Every game fair.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "rgba(236,232,224,0.7)",
              lineHeight: 1.6,
              margin: 0,
              fontFamily: "var(--font-body)",
            }}
          >
            The first backgammon platform with provably fair dice on the
            blockchain. No trust required — verify every roll yourself.
          </p>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 32,
            }}
          >
            {["Provably Fair", "USDC Wagering", "World-Class AI", "15+ Variants"].map(
              (feat) => (
                <span
                  key={feat}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid rgba(236,232,224,0.2)",
                    fontSize: 12,
                    color: "rgba(236,232,224,0.85)",
                    fontWeight: 500,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {feat}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Connect Panel ── */}
      <div
        className="p-6 sm:p-10 lg:px-[60px] lg:py-10"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          background: "var(--color-bg-base)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Logo + Brand */}
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <DiceLogo size={56} />
            <h1
              className="text-2xl lg:text-[32px]"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.03em",
                margin: "16px 0 0",
              }}
            >
              Gammon
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "var(--color-text-secondary)",
                margin: "10px 0 0",
                lineHeight: 1.5,
                fontFamily: "var(--font-body)",
              }}
            >
              The world&apos;s fairest backgammon platform
            </p>
          </div>

          {/* Login Button */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              marginTop: 8,
            }}
          >
            <GammonButton onClick={() => login()} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "2px solid var(--color-accent-fg)",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </GammonButton>
          </div>

          {/* Footer */}
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-faint)",
              textAlign: "center",
              lineHeight: 1.6,
              marginTop: 8,
              fontFamily: "var(--font-body)",
            }}
          >
            By continuing, you agree to the{" "}
            <span
              style={{
                color: "var(--color-text-muted)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Terms of Service
            </span>{" "}
            and{" "}
            <span
              style={{
                color: "var(--color-text-muted)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Privacy Policy
            </span>
          </p>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
