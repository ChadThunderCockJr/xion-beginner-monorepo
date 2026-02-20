"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/hooks/useAuth";
import { WS_URL } from "@/lib/ws-config";

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
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        padding: 20,
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Local Avatar Component ─────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-bg-elevated)",
        border: "2px solid var(--color-gold-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: "var(--color-text-secondary)",
        flexShrink: 0,
      }}
    >
      {name[0]}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--color-gold-primary)"
      strokeWidth="1.5"
    >
      <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
      <path
        d="M6 8l1.5 1.5L10.5 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Pulsing Dot ────────────────────────────────────────────────
function PulsingDot() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(interval);
  }, []);
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "var(--color-gold-primary)",
        opacity: pulse ? 1 : 0.3,
        transition: "opacity 0.4s ease",
      }}
    />
  );
}

// ═════════════════════════════════════════════════════════════════
// JOIN CODE PAGE — Loading, Countdown, Invalid screens
// ═════════════════════════════════════════════════════════════════
export default function JoinCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [countdownVal, setCountdownVal] = useState(3);
  const joinedRef = useRef(false);

  const { address, isConnected } = useAuth();

  const {
    connected,
    status,
    gameId,
    opponent,
    error,
    joinGame,
  } = useGame(WS_URL, address);

  const shortAddr = (addr: string | null) => {
    if (!addr) return "?";
    if (addr.length <= 12) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  // Basic code validation
  const isValidCode = /^[a-zA-Z0-9-]{3,}$/.test(params.code);

  // Join the game immediately once connected
  useEffect(() => {
    if (connected && isValidCode && !joinedRef.current) {
      joinedRef.current = true;
      joinGame(params.code);
    }
  }, [connected, isValidCode, params.code, joinGame]);

  // Determine which screen to show
  const isError = !isValidCode || !!error;
  const isPlaying = status === "playing";
  const isLoading = !isError && !isPlaying;

  // Countdown timer → navigate to match
  useEffect(() => {
    if (isPlaying && countdownVal > 0) {
      const timer = setTimeout(() => setCountdownVal((v) => v - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (isPlaying && countdownVal === 0 && gameId) {
      const navTimer = setTimeout(() => router.push(`/match/${gameId}`), 500);
      return () => clearTimeout(navTimer);
    }
  }, [isPlaying, countdownVal, gameId, router]);

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
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
        }}
      >
        <button
          onClick={() => router.push("/join")}
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
          &larr; Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!connected && (
            <span style={{ fontSize: "0.6875rem", color: "var(--color-danger)", fontWeight: 600 }}>
              Reconnecting...
            </span>
          )}
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
        </div>
        <div style={{ width: 60 }} /> {/* spacer for centering */}
      </header>

      {/* ─── Main Content ───────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "40px 24px",
          overflow: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* ═══ LOADING ══════════════════════════════════════ */}
          {isLoading && (
            <div
              className="pt-6 sm:pt-[60px]"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <PulsingDot />
                <PulsingDot />
                <PulsingDot />
              </div>
              <div style={{ textAlign: "center" }}>
                <h2
                  className="text-xl sm:text-[26px]"
                  style={{
                    fontWeight: 700,
                    margin: "0 0 8px",
                    letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Joining Match...
                </h2>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-text-secondary)",
                    margin: 0,
                  }}
                >
                  Connecting to game server
                </p>
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-muted)",
                  padding: "8px 16px",
                  background: "var(--color-bg-base)",
                  borderRadius: 6,
                  border: "1px solid var(--color-border-subtle)",
                  wordBreak: "break-all",
                }}
              >
                {params.code}
              </div>
            </div>
          )}

          {/* ═══ COUNTDOWN ══════════════════════════════════ */}
          {isPlaying && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
                paddingTop: 20,
              }}
            >
              {/* VS display */}
              <div
                className="gap-4 sm:gap-6"
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <Avatar name={shortAddr(address)} size={64} />
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      marginTop: 8,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {shortAddr(address)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--color-gold-dark)",
                    padding: "0 8px",
                  }}
                >
                  vs
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <Avatar name={shortAddr(opponent)} size={64} />
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      marginTop: 8,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {shortAddr(opponent)}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <h2
                  className="text-2xl sm:text-[32px]"
                  style={{
                    fontWeight: 700,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Match Starting
                </h2>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-text-secondary)",
                    margin: 0,
                  }}
                >
                  Casual match &mdash; no stakes
                </p>
              </div>

              {/* Countdown */}
              <div
                className="text-5xl sm:text-7xl md:text-[96px]"
                style={{
                  fontWeight: 700,
                  color: "var(--color-gold-primary)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "-0.02em",
                  textShadow: "var(--shadow-gold)",
                }}
              >
                {countdownVal > 0 ? countdownVal : "GO"}
              </div>

              {/* Provably fair badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.6875rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                <ShieldIcon size={14} />
                Provably fair dice &middot; Game board loading...
              </div>
            </div>
          )}

          {/* ═══ INVALID CODE / ERROR ════════════════════════ */}
          {isError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                paddingTop: 40,
              }}
            >
              {/* Error icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--color-bg-elevated)",
                  border: "2px solid var(--color-border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  color: "var(--color-text-muted)",
                }}
              >
                &#x2715;
              </div>

              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    margin: "0 0 8px",
                    letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Match Not Found
                </h2>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-text-secondary)",
                    margin: 0,
                    maxWidth: 320,
                    lineHeight: 1.6,
                  }}
                >
                  {error ||
                    "This code may have expired or the host may have cancelled the match. Check with your opponent and try again."}
                </p>
              </div>

              <Card
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: "0.625rem",
                    color: "var(--color-text-muted)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Entered Code
                </div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    textDecoration: "line-through",
                    wordBreak: "break-all",
                  }}
                >
                  {params.code}
                </div>
              </Card>

              <div
                style={{ display: "flex", gap: 10, width: "100%" }}
              >
                <Link href="/join" style={{ flex: 1, textDecoration: "none" }}>
                  <button
                    style={{
                      width: "100%",
                      padding: "14px 20px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        "linear-gradient(135deg, var(--color-gold-primary) 0%, var(--color-gold-light) 100%)",
                      color: "var(--color-accent-fg)",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      boxShadow: "var(--shadow-gold)",
                    }}
                  >
                    Try Another Code
                  </button>
                </Link>
                <Link href="/" style={{ flex: 1, textDecoration: "none" }}>
                  <button
                    style={{
                      width: "100%",
                      padding: "14px 20px",
                      borderRadius: 6,
                      border: "1.5px solid var(--color-border-subtle)",
                      background: "var(--color-bg-surface)",
                      color: "var(--color-text-secondary)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Back to Lobby
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
