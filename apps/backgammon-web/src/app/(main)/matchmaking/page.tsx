"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/hooks/useAuth";
import { WS_URL } from "@/lib/ws-config";

// ─── Pulsing dot animation ───────────────────────────────────────────────
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

// ─── Matchmaking Avatar ──────────────────────────────────────────────────
function MatchAvatar({ name, size = 64 }: { name: string; size?: number }) {
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
        fontSize: size * 0.35,
        fontWeight: 700,
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-body)",
      }}
    >
      {name[0]}
    </div>
  );
}

// ─── Timer display ───────────────────────────────────────────────────────
function Timer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 32,
        fontWeight: 700,
        color: "var(--color-gold-primary)",
        letterSpacing: "0.04em",
      }}
    >
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN MATCHMAKING PAGE
// ═════════════════════════════════════════════════════════════════════════
export default function MatchmakingPage() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [uiState, setUiState] = useState<"searching" | "found" | "countdown">("searching");
  const joinedRef = useRef(false);

  const { address, isConnected } = useAuth();
  const {
    connected,
    status,
    gameId,
    opponent,
    error,
    joinQueue,
    leaveQueue,
    reset,
  } = useGame(WS_URL, address);

  // Join queue once connected
  useEffect(() => {
    if (connected && !joinedRef.current && (status === "idle" || status === "queued")) {
      joinedRef.current = true;
      joinQueue(0);
    }
  }, [connected, status, joinQueue]);

  // Reset join flag on disconnect so we re-join on reconnect
  useEffect(() => {
    if (!connected) joinedRef.current = false;
  }, [connected]);

  // Track elapsed search time
  useEffect(() => {
    if (uiState === "searching") {
      const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [uiState]);

  // When game starts (opponent matched), transition to "found" UI
  useEffect(() => {
    if (status === "playing" && gameId) {
      setUiState("found");
    }
  }, [status, gameId]);

  // Auto-start countdown after "found" state shows briefly
  useEffect(() => {
    if (uiState === "found") {
      const timer = setTimeout(() => setUiState("countdown"), 1500);
      return () => clearTimeout(timer);
    }
  }, [uiState]);

  // Countdown timer → navigate to match
  useEffect(() => {
    if (uiState === "countdown" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (uiState === "countdown" && countdown === 0 && gameId) {
      const navTimer = setTimeout(() => router.push(`/match/${gameId}`), 500);
      return () => clearTimeout(navTimer);
    }
  }, [uiState, countdown, gameId, router]);

  const handleCancel = () => {
    leaveQueue();
    reset();
    router.push("/");
  };

  const shortAddr = (addr: string | null) => {
    if (!addr) return "?";
    if (addr.length <= 12) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  // Connection error state
  if (error && !connected) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-bg-deepest)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
          color: "var(--color-text-primary)",
          gap: 16,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            color: "var(--color-danger)",
          }}
        >
          Connection Error
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", textAlign: "center" }}>
          {error || "Unable to connect to game server. Please try again."}
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "12px 32px",
            borderRadius: 8,
            border: "1.5px solid var(--color-bg-subtle)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text-secondary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-deepest)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-body)",
        color: "var(--color-text-primary)",
      }}
    >
      {/* ─── Top Bar ──────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--color-bg-subtle)",
        }}
      >
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleCancel();
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-body)",
            textDecoration: "none",
          }}
        >
          &larr; Back to lobby
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!connected && (
            <span style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 600 }}>
              Reconnecting...
            </span>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Quick Match
          </span>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          gap: 32,
        }}
      >
        {/* ═══ SEARCHING STATE ════════════════════════════ */}
        {uiState === "searching" && (
          <>
            {/* Searching animation area */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              {/* Your avatar + searching indicator */}
              <div style={{ position: "relative" }}>
                <MatchAvatar name={shortAddr(address)} size={64} />
                {/* Spinning ring placeholder */}
                <div
                  style={{
                    position: "absolute",
                    inset: -8,
                    borderRadius: "50%",
                    border: "2.5px solid var(--color-bg-subtle)",
                    borderTopColor: "var(--color-gold-primary)",
                  }}
                />
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
                  Finding opponent...
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-secondary)",
                    margin: 0,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Searching for an available player
                </p>
              </div>

              {/* Elapsed time */}
              <Timer seconds={elapsed} />

              {/* Search status dots */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <PulsingDot />
                <PulsingDot />
                <PulsingDot />
              </div>
            </div>

            {/* Match settings summary */}
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 16px",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-bg-subtle)",
                borderRadius: 10,
              }}
            >
              {[
                { label: "Match", value: "Quick" },
                { label: "Wager", value: "Free" },
                { label: "Mode", value: "Casual" },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: "center", minWidth: 60 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontWeight: 600,
                      marginBottom: 4,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Expanding range notice */}
            {elapsed > 5 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-body)",
                }}
              >
                Still searching for an opponent...
              </p>
            )}

            {/* Cancel */}
            <button
              onClick={handleCancel}
              style={{
                padding: "12px 32px",
                borderRadius: 8,
                border: "1.5px solid var(--color-bg-subtle)",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Cancel Search
            </button>
          </>
        )}

        {/* ═══ OPPONENT FOUND STATE ═══════════════════════ */}
        {uiState === "found" && (
          <>
            <div
              className="gap-6 sm:gap-10"
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              {/* You */}
              <div style={{ textAlign: "center" }}>
                <MatchAvatar name={shortAddr(address)} size={80} />
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    You
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {shortAddr(address)}
                  </div>
                </div>
              </div>

              {/* VS */}
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "var(--color-gold-dark)",
                  letterSpacing: "0.1em",
                  fontFamily: "var(--font-body)",
                }}
              >
                VS
              </div>

              {/* Opponent */}
              <div style={{ textAlign: "center" }}>
                <MatchAvatar name={shortAddr(opponent)} size={80} />
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Opponent
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {shortAddr(opponent)}
                  </div>
                </div>
              </div>
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
                Opponent found!
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--color-text-secondary)",
                  margin: 0,
                  fontFamily: "var(--font-body)",
                }}
              >
                Get ready to play
              </p>
            </div>
          </>
        )}

        {/* ═══ COUNTDOWN STATE ════════════════════════════ */}
        {uiState === "countdown" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 48,
              }}
            >
              {/* You */}
              <div style={{ textAlign: "center" }}>
                <MatchAvatar name={shortAddr(address)} size={72} />
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    You
                  </div>
                </div>
              </div>

              {/* Countdown number */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  border: "3px solid var(--color-gold-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 800,
                  color: "var(--color-gold-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {countdown > 0 ? countdown : "GO"}
              </div>

              {/* Opponent */}
              <div style={{ textAlign: "center" }}>
                <MatchAvatar name={shortAddr(opponent)} size={72} />
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {shortAddr(opponent)}
                  </div>
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: 15,
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                fontFamily: "var(--font-body)",
              }}
            >
              {countdown > 0 ? "Match starting..." : "Loading board..."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
