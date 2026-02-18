"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout";
import { Card, SectionLabel, Avatar, Badge } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { formatMove } from "@xion-beginner/backgammon-core";
import type { MoveRecord, Player } from "@xion-beginner/backgammon-core";
import { API_BASE } from "@/lib/api";
import type { MatchResult } from "@/lib/api";

// ─── Icons ─────────────────────────────────────────────────────────

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--color-gold-primary)" strokeWidth="1.5">
      <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
      <path d="M6 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="1.5"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Dice Face (small inline) ──────────────────────────────────────

function DiceFace({ value }: { value: number }) {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[5, 5]],
    2: [[2, 2], [8, 8]],
    3: [[2, 2], [5, 5], [8, 8]],
    4: [[2, 2], [8, 2], [2, 8], [8, 8]],
    5: [[2, 2], [8, 2], [5, 5], [2, 8], [8, 8]],
    6: [[2, 2], [8, 2], [2, 5], [8, 5], [2, 8], [8, 8]],
  };
  const dots = dotPositions[value] || [];
  return (
    <svg width="20" height="20" viewBox="0 0 11 11">
      <rect x="0.5" y="0.5" width="10" height="10" rx="2" fill="var(--color-bg-elevated)" stroke="var(--color-bg-subtle)" strokeWidth="0.5" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.1" fill="var(--color-text-primary)" />
      ))}
    </svg>
  );
}

// ─── Distribution Bar ──────────────────────────────────────────────

function DistributionBar({ face, count, total }: { face: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const expected = 100 / 6;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <DiceFace value={face} />
      <div style={{ flex: 1, height: 14, background: "var(--color-bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: Math.abs(pct - expected) > 5 ? "var(--color-gold-primary)" : "var(--color-text-muted)",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", minWidth: 55, textAlign: "right" }}>
        {count} ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

// ─── Roll Log Table ────────────────────────────────────────────────

function RollLog({ moveHistory }: { moveHistory: MoveRecord[] }) {
  if (moveHistory.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--color-text-faint)", textAlign: "center", padding: "12px 0" }}>
        No moves recorded for this game.
      </p>
    );
  }

  // Dice distribution stats
  const faceCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let totalDice = 0;
  for (const record of moveHistory) {
    faceCounts[record.dice[0]]++;
    faceCounts[record.dice[1]]++;
    totalDice += 2;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Turn-by-turn log */}
      <div>
        <SectionLabel>Turn Log</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-bg-subtle)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Dice</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Moves</th>
              </tr>
            </thead>
            <tbody>
              {moveHistory.map((record) => (
                <tr key={record.turnNumber} style={{ borderBottom: "1px solid var(--color-bg-subtle)" }}>
                  <td style={tdStyle}>{record.turnNumber}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: record.player === "white" ? "var(--color-text-primary)" : "#6E1A30",
                      border: `1px solid ${record.player === "white" ? "var(--color-text-secondary)" : "var(--color-burgundy-deep)"}`,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }} />
                    <span style={{ verticalAlign: "middle", textTransform: "capitalize" }}>{record.player}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                      <DiceFace value={record.dice[0]} />
                      <DiceFace value={record.dice[1]} />
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {record.moves.length > 0
                      ? record.moves.map((m) => formatMove(m, record.player)).join(", ")
                      : "No moves"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dice distribution */}
      <div>
        <SectionLabel>Dice Distribution</SectionLabel>
        <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginBottom: 10 }}>
          {totalDice} dice rolled across {moveHistory.length} turns. Expected: ~16.7% each.
        </p>
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <DistributionBar key={face} face={face} count={faceCounts[face]} total={totalDice} />
        ))}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--color-text-muted)",
  textAlign: "center",
  fontFamily: "var(--font-mono)",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 8px",
  textAlign: "center",
  color: "var(--color-text-secondary)",
  verticalAlign: "middle",
};

// ─── Match Row (accordion) ─────────────────────────────────────────

function MatchRow({ match }: { match: MatchResult }) {
  const [expanded, setExpanded] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (moveHistory) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/game/${match.gameId}/history`);
      if (res.ok) {
        const data = await res.json();
        setMoveHistory(data.moveHistory);
      } else {
        setMoveHistory([]);
      }
    } catch {
      setMoveHistory([]);
    } finally {
      setLoading(false);
    }
  }, [expanded, moveHistory, match.gameId]);

  const date = new Date(match.timestamp);
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ borderBottom: "1px solid var(--color-bg-subtle)" }}>
      <button
        onClick={toggleExpand}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Avatar name={match.opponentName || match.opponent} size="xs" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
            vs {match.opponentName || `${match.opponent.slice(0, 8)}...`}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{dateStr}</div>
        </div>
        <Badge variant={match.result === "W" ? "win" : "loss"}>
          {match.result === "W" ? "Win" : "Loss"}
        </Badge>
        <span style={{ fontSize: 10, color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
          {match.gameId.slice(0, 6)}
        </span>
        <ChevronIcon open={expanded} />
      </button>

      {expanded && (
        <div style={{ padding: "0 4px 14px" }}>
          {loading ? (
            <p style={{ fontSize: 12, color: "var(--color-text-faint)", textAlign: "center", padding: "12px 0" }}>
              Loading roll history...
            </p>
          ) : moveHistory ? (
            <RollLog moveHistory={moveHistory} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VERIFY ROLLS PAGE
// ═══════════════════════════════════════════════════════════════════

export default function VerifyRollsPage() {
  const { address } = useAuth();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/matches/${address}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMatches(data.matches);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  return (
    <div style={{ width: "100%", minHeight: "100dvh" }}>
      <Header title="Verify Rolls" backHref="/" />

      <div className="p-4 md:px-6 md:py-7" style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Explanation Card */}
        <Card
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-burgundy-deep)",
            borderLeft: "3px solid var(--color-burgundy-primary)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <ShieldIcon size={22} />
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              color: "var(--color-text-primary)",
            }}>
              Provably Fair Dice
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>
            All dice rolls use <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}>node:crypto</code> CSPRNG
            (cryptographically secure pseudorandom number generator). Every roll is logged and can be audited.
            Expand any match below to inspect the full roll history and dice distribution.
          </p>
        </Card>

        {/* Match List */}
        <Card>
          <SectionLabel>Past Matches</SectionLabel>

          {loading ? (
            <p style={{ fontSize: 13, color: "var(--color-text-faint)", textAlign: "center", padding: "24px 0" }}>
              Loading matches...
            </p>
          ) : !address ? (
            <p style={{ fontSize: 13, color: "var(--color-text-faint)", textAlign: "center", padding: "24px 0" }}>
              Connect your wallet to view past matches.
            </p>
          ) : matches.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-faint)", textAlign: "center", padding: "24px 0" }}>
              No matches found. Play a game to see your roll history here.
            </p>
          ) : (
            matches.map((match) => (
              <MatchRow key={match.gameId} match={match} />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
