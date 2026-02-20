"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Local Card Component ───────────────────────────────────────
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-bg-subtle)",
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// JOIN PAGE — "Enter Code" Screen
// ═════════════════════════════════════════════════════════════════
export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const walletBalance = 124.5;

  const handleLookUp = () => {
    const trimmed = code.trim();
    if (trimmed) {
      router.push(`/join/${trimmed}`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        fontFamily: "var(--font-body)",
        color: "var(--color-text-primary)",
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--color-bg-subtle)",
          background: "var(--color-bg-surface)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-body)",
          }}
        >
          &larr; Back to lobby
        </button>
        <span
          style={{
            fontSize: "1.0625rem",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          Join Match
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            border: "1px solid var(--color-bg-subtle)",
            borderRadius: 20,
            background: "var(--color-bg-surface)",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--color-gold-primary)",
            }}
          >
            ${walletBalance.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: "0.625rem",
              color: "var(--color-text-muted)",
            }}
          >
            USDC
          </span>
        </div>
      </header>

      {/* ─── Main Content ───────────────────────────────────── */}
      <main
        className="px-4 py-6 sm:px-6 sm:py-10"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            {/* Heading */}
            <div style={{ textAlign: "center" }}>
              <h2
                className="text-2xl sm:text-4xl"
                style={{
                  fontWeight: 700,
                  margin: "0 0 8px",
                  letterSpacing: "-0.02em",
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text-primary)",
                }}
              >
                Join a Match
              </h2>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                  margin: 0,
                }}
              >
                Enter the match code shared by your opponent
              </p>
            </div>

            {/* Card with inputs */}
            <Card style={{ width: "100%" }}>
              {/* Code input label */}
              <div
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                }}
              >
                Match Code
              </div>

              {/* Code input */}
              <input
                type="text"
                placeholder="MATCH-XXXXX-XXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookUp();
                }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 6,
                  border: `2px solid ${code.length > 0 ? "var(--color-gold-primary)" : "var(--color-bg-subtle)"}`,
                  background: "var(--color-bg-base)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease",
                }}
              />

              {/* Or paste link divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "16px 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--color-bg-subtle)",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  or paste a link
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--color-bg-subtle)",
                  }}
                />
              </div>

              {/* Link input */}
              <input
                type="text"
                placeholder="play.platform.com/join/..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "1.5px solid var(--color-bg-subtle)",
                  background: "var(--color-bg-base)",
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  outline: "none",
                  fontFamily: "var(--font-mono)",
                  boxSizing: "border-box",
                }}
              />
            </Card>

            {/* Look Up Match button */}
            <button
              onClick={handleLookUp}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 6,
                border: "none",
                background:
                  "linear-gradient(135deg, var(--color-gold-primary) 0%, var(--color-gold-light) 100%)",
                color: "var(--color-accent-fg)",
                fontSize: "0.9375rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                letterSpacing: "-0.01em",
                opacity: code.length > 0 ? 1 : 0.4,
                pointerEvents: code.length > 0 ? "auto" : "none",
                boxShadow: "var(--shadow-gold)",
                transition: "opacity 0.2s",
              }}
            >
              Look Up Match &rarr;
            </button>

            {/* Scan QR Code button */}
            <button
              style={{
                background: "none",
                border: "none",
                fontSize: "0.8125rem",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-secondary)"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="4" height="4" rx="0.5" />
                <path
                  d="M21 14h-3v3M18 21h3v-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Scan QR Code
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
