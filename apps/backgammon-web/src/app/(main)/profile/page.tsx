"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout";
import {
  Card,
  SectionLabel,
  SegmentToggle,
} from "@/components/ui";
import { useSocialContext } from "@/contexts/SocialContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";

// ─── Constants ─────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Statistics" },
  { id: "history", label: "Match History" },
  { id: "settings", label: "Settings" },
];

const HISTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "wins", label: "Wins" },
  { id: "losses", label: "Losses" },
  { id: "wagers", label: "Wagers" },
];

const PROFILE = {
  name: "Anthony",
  rating: 1847,
  ratingChange: 23,
  bio: "Competitive backgammon player \u00b7 Learning XG",
  memberSince: "March 2023",
  wins: 847,
  losses: 612,
  draws: 34,
  totalGames: 1493,
  avgPR: 5.2,
  streak: "4W",
};

const MATCHES = [
  { opponent: "MarcGM", result: "W" as const, score: "7\u20134", pr: "4.1", wager: "Free", date: "2h ago" },
  { opponent: "DiceKing99", result: "L" as const, score: "3\u20137", pr: "6.8", wager: "$1.00", date: "Yesterday" },
  { opponent: "NardePlayer", result: "W" as const, score: "7\u20132", pr: "3.2", wager: "Free", date: "Yesterday" },
  { opponent: "BackgamPro", result: "W" as const, score: "5\u20133", pr: "4.9", wager: "$0.50", date: "2 days ago" },
  { opponent: "AIExpert", result: "L" as const, score: "2\u20137", pr: "7.1", wager: "Free", date: "3 days ago" },
  { opponent: "TavlaQueen", result: "W" as const, score: "7\u20131", pr: "2.8", wager: "$2.50", date: "4 days ago" },
  { opponent: "DiceRoller", result: "W" as const, score: "7\u20135", pr: "3.6", wager: "Free", date: "5 days ago" },
  { opponent: "BGMaster", result: "L" as const, score: "4\u20137", pr: "5.2", wager: "$5.00", date: "1 week ago" },
  { opponent: "PointBuilder", result: "W" as const, score: "7\u20133", pr: "4.4", wager: "Free", date: "1 week ago" },
  { opponent: "CubeKing", result: "L" as const, score: "5\u20137", pr: "5.8", wager: "$1.00", date: "2 weeks ago" },
];

const TRANSACTIONS = [
  { type: "Deposit", amount: "+$50.00", status: "Confirmed", date: "3 days ago" },
  { type: "Wager Lost", amount: "\u2212$12.50", status: "Settled", date: "2 days ago" },
  { type: "Wager Won", amount: "+$8.75", status: "Settled", date: "1 day ago" },
  { type: "Deposit", amount: "+$100.00", status: "Confirmed", date: "1 week ago" },
  { type: "Withdrawal", amount: "\u2212$25.00", status: "Confirmed", date: "2 weeks ago" },
];

const BOARD_THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const NOTATION_STYLES = [
  { id: "international", label: "International" },
  { id: "american", label: "American" },
];

// ─── Icons ─────────────────────────────────────────────────────────
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5">
      <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
      <path d="M6 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <path d="M14 10.5a1 1 0 100 2 1 1 0 000-2z" fill="var(--color-text-muted)" />
      <path d="M2 8h16" />
    </svg>
  );
}

// ─── Quick Stat ────────────────────────────────────────────────────
function QuickStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{
        fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)",
        fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
      }}>{value}</div>
      <div style={{
        fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase",
        letterSpacing: "0.04em", fontWeight: 600, marginTop: 2,
      }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11, cursor: "pointer",
      background: on ? "var(--color-gold-primary)" : "var(--color-bg-subtle)",
      position: "relative", transition: "background 0.15s ease", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "var(--color-text-primary)", position: "absolute", top: 2,
        left: on ? 20 : 2, transition: "left 0.15s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </div>
  );
}

// ─── Match Row (profile-specific with PR and Wager columns) ───────
function ProfileMatchRow({ opponent, result, score, pr, wager, date }: {
  opponent: string; result: "W" | "L"; score: string; pr: string; wager: string; date: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 0", borderBottom: "1px solid var(--color-bg-subtle)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "var(--color-bg-elevated)", border: "2px solid var(--color-bg-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", flexShrink: 0,
      }}>{opponent[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{opponent}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{date}</div>
      </div>
      <div style={{
        padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
        background: result === "W" ? "rgba(96,168,96,0.125)" : "rgba(204,68,68,0.125)",
        border: `1px solid ${result === "W" ? "var(--color-success)" : "var(--color-danger)"}`,
        color: result === "W" ? "var(--color-success)" : "var(--color-danger)",
      }}>{result} {score}</div>
      <div style={{
        fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600,
        fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right",
      }}>{pr}</div>
      <div style={{
        fontSize: 11, color: wager === "Free" ? "var(--color-text-muted)" : "var(--color-text-primary)",
        fontWeight: 600, minWidth: 40, textAlign: "right",
      }}>{wager}</div>
    </div>
  );
}

// ─── Horizontal Bar ────────────────────────────────────────────────
function HorizontalBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)",
          fontFamily: "var(--font-mono)",
        }}>{count}</span>
      </div>
      <div style={{
        height: 8, borderRadius: 4, background: "var(--color-bg-elevated)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 4,
          background: color || "var(--color-gold-primary)",
          width: `${(count / max) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────────────────────
function TransactionRow({ type, amount, status, date }: { type: string; amount: string; status: string; date: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0", borderBottom: "1px solid var(--color-bg-subtle)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: "var(--color-bg-base)", border: "1px solid var(--color-bg-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "var(--color-text-secondary)",
      }}>
        {type === "Deposit" ? "\u2193" : type === "Withdrawal" ? "\u2191" : amount.startsWith("+") ? "+" : "\u2212"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{type}</div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)",
          fontFamily: "var(--font-mono)",
        }}>{amount}</div>
        <div style={{
          fontSize: 9, color: "var(--color-text-muted)", textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>{status}</div>
      </div>
    </div>
  );
}

// ─── Rating Chart (SVG) ────────────────────────────────────────────
function RatingChart() {
  const w = 600, h = 180, padX = 40, padY = 20;
  const data = [
    1824, 1830, 1828, 1835, 1832, 1840, 1838, 1845, 1842, 1836,
    1840, 1848, 1845, 1852, 1849, 1855, 1850, 1843, 1847, 1853,
    1856, 1860, 1857, 1850, 1845, 1848, 1852, 1855, 1847, 1847,
  ];
  const minR = 1820, maxR = 1865;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - ((v - minR) / (maxR - minR)) * chartH;
    return `${x},${y}`;
  });

  const midY = padY + chartH - ((1842 - minR) / (maxR - minR)) * chartH;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {[1820, 1830, 1840, 1850, 1860].map((v) => {
        const y = padY + chartH - ((v - minR) / (maxR - minR)) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--color-bg-subtle)" strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)"
              fontFamily="var(--font-mono)">{v}</text>
          </g>
        );
      })}
      <line x1={padX} y1={midY} x2={w - padX} y2={midY}
        stroke="var(--color-bg-subtle)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={w - padX + 4} y={midY + 3} fontSize="8" fill="var(--color-text-muted)"
        fontFamily="var(--font-mono)">avg</text>
      <polygon
        points={`${padX},${padY + chartH} ${points.join(" ")} ${w - padX},${padY + chartH}`}
        fill="var(--color-gold-muted)" />
      <polyline points={points.join(" ")} fill="none" stroke="var(--color-gold-primary)"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w - padX} cy={padY + chartH - ((1847 - minR) / (maxR - minR)) * chartH}
        r="4" fill="var(--color-gold-primary)" />
      <text x={padX} y={h - 2} fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">Day 1</text>
      <text x={w / 2} y={h - 2} fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-mono)"
        textAnchor="middle">Day 15</text>
      <text x={w - padX} y={h - 2} fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-mono)"
        textAnchor="end">Today</text>
    </svg>
  );
}

// ─── PR Trend Chart (SVG) ──────────────────────────────────────────
function PRTrendChart() {
  const w = 600, h = 160, padX = 40, padY = 20;
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const yourPR = [6.8, 6.2, 5.9, 5.5, 5.4, 5.2];
  const platPR = [7.1, 7.0, 6.9, 7.0, 6.8, 6.9];
  const minPR = 4, maxPR = 8;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const toPoints = (arr: number[]) => arr.map((v, i) => {
    const x = padX + (i / (arr.length - 1)) * chartW;
    const y = padY + chartH - ((v - minPR) / (maxPR - minPR)) * chartH;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {[4, 5, 6, 7, 8].map((v) => {
        const y = padY + chartH - ((v - minPR) / (maxPR - minPR)) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--color-bg-subtle)" strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)"
              fontFamily="var(--font-mono)">{v}.0</text>
          </g>
        );
      })}
      {/* Platform avg (dashed) */}
      <polyline points={toPoints(platPR)} fill="none" stroke="var(--color-bg-subtle)"
        strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round" />
      {/* Your PR (solid) */}
      <polyline points={toPoints(yourPR)} fill="none" stroke="var(--color-gold-primary)"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Month labels */}
      {months.map((m, i) => (
        <text key={m} x={padX + (i / (months.length - 1)) * chartW} y={h - 2}
          fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-mono)"
          textAnchor="middle">{m}</text>
      ))}
      {/* Legend */}
      <line x1={w - 140} y1={12} x2={w - 120} y2={12} stroke="var(--color-gold-primary)" strokeWidth="2" />
      <text x={w - 116} y={15} fontSize="9" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">You</text>
      <line x1={w - 80} y1={12} x2={w - 60} y2={12} stroke="var(--color-bg-subtle)"
        strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={w - 56} y={15} fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">Platform</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN — PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const { address } = useAuth();
  const social = useSocialContext();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [displayName, setDisplayName] = useState(PROFILE.name);
  const [email, setEmail] = useState("anthony@example.com");

  // Sync display name from social context
  useEffect(() => {
    if (social.displayName) {
      setDisplayName(social.displayName);
    }
  }, [social.displayName]);

  // Save display name on blur
  const handleDisplayNameBlur = useCallback(() => {
    if (displayName.trim() && displayName !== social.displayName) {
      social.setDisplayName(displayName.trim());
    }
  }, [displayName, social]);
  const [boardTheme, setBoardTheme] = useState("light");
  const [notationStyle, setNotationStyle] = useState("international");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [notifications, setNotifications] = useState({
    matchInvites: true,
    friendRequests: true,
    tournamentAlerts: false,
  });
  const [historyFilter, setHistoryFilter] = useState("all");

  const walletBalance = 124.50;

  const filteredMatches = MATCHES.filter((m) => {
    if (historyFilter === "wins") return m.result === "W";
    if (historyFilter === "losses") return m.result === "L";
    if (historyFilter === "wagers") return m.wager !== "Free";
    return true;
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body)",
      color: "var(--color-text-primary)",
    }}>

      {/* ─── Header ─────────────────────────────────────────── */}
      <Header
        title="Profile"
        backHref="/lobby"
        actions={
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", border: "1px solid var(--color-bg-subtle)",
            borderRadius: 8, background: "var(--color-bg-surface)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gold-primary)" }}>${walletBalance.toFixed(2)}</span>
            <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>USDC</span>
          </div>
        }
      />

      {/* ─── Main Content ───────────────────────────────────── */}
      <main className="p-4 md:p-6 lg:px-6 lg:py-7" style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", overflow: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 700 }}>

          {/* ═══ PROFILE HEADER ══════════════════════════════ */}
          <Card style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Avatar */}
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "var(--color-bg-elevated)", border: "2px solid var(--color-bg-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, fontWeight: 700, color: "var(--color-text-secondary)", flexShrink: 0,
                }}>{(social.displayName || social.username || PROFILE.name)[0]}</div>
                <div style={{
                  position: "absolute", bottom: 2, right: 2,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--color-success)", border: "3px solid var(--color-bg-surface)",
                }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display)", color: "var(--color-text-primary)",
                  }}>
                    {social.displayName || social.username || PROFILE.name}
                  </span>
                  <div style={{
                    display: "flex", alignItems: "baseline", gap: 4,
                    padding: "3px 10px", borderRadius: 6,
                    background: "var(--color-bg-base)", border: "1px solid var(--color-bg-subtle)",
                  }}>
                    <span style={{
                      fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)",
                      fontFamily: "var(--font-mono)",
                    }}>{PROFILE.rating.toLocaleString()}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: PROFILE.ratingChange >= 0 ? "var(--color-success)" : "var(--color-danger)",
                    }}>
                      {PROFILE.ratingChange >= 0 ? "\u2191" : "\u2193"}{Math.abs(PROFILE.ratingChange)}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  {PROFILE.bio}
                </div>
                <div style={{
                  fontSize: 11, color: "var(--color-text-muted)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  {address && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      {address.slice(0, 16)}...{address.slice(-6)}
                    </span>
                  )}
                  <span>Member since {PROFILE.memberSince}</span>
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", background: "var(--color-success)",
                    }} />
                    Online
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div style={{
              display: "flex", gap: 0, marginTop: 20, paddingTop: 16,
              borderTop: "1px solid var(--color-bg-subtle)",
            }}>
              <QuickStat label="Games" value={PROFILE.totalGames.toLocaleString()} />
              <div style={{ width: 1, background: "var(--color-bg-subtle)" }} />
              <QuickStat label="W / L" value={`${PROFILE.wins} / ${PROFILE.losses}`} sub={`${PROFILE.draws} draws`} />
              <div style={{ width: 1, background: "var(--color-bg-subtle)" }} />
              <QuickStat label="Avg PR" value={PROFILE.avgPR.toFixed(1)} sub="Advanced" />
              <div style={{ width: 1, background: "var(--color-bg-subtle)" }} />
              <QuickStat label="Streak" value={PROFILE.streak} />
            </div>
          </Card>

          {/* ═══ TAB BAR ═════════════════════════════════════ */}
          <div style={{
            display: "flex", gap: 0, background: "var(--color-bg-surface)",
            borderLeft: "1px solid var(--color-bg-subtle)",
            borderRight: "1px solid var(--color-bg-subtle)",
            borderBottom: "1px solid var(--color-bg-subtle)",
            borderRadius: "0 0 8px 8px",
            marginBottom: 20,
          }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: "14px 0", background: "none", border: "none",
                  borderBottom: `2.5px solid ${active ? "var(--color-gold-primary)" : "transparent"}`,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.1s ease",
                }}>{tab.label}</button>
              );
            })}
          </div>

          {/* ═══ TAB CONTENT ═════════════════════════════════ */}

          {/* ─── OVERVIEW ──────────────────────────────────── */}
          {activeTab === "overview" && (
            <>
              {/* Recent Matches */}
              <Card style={{ marginBottom: 20 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 12,
                }}>
                  <SectionLabel>Recent Matches</SectionLabel>
                  <button onClick={() => setActiveTab("history")} style={{
                    background: "none", border: "none", fontSize: 11,
                    color: "var(--color-text-secondary)", fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}>View all &rarr;</button>
                </div>
                {MATCHES.slice(0, 5).map((m, i) => (
                  <ProfileMatchRow key={i} {...m} />
                ))}
              </Card>
            </>
          )}

          {/* ─── STATISTICS ────────────────────────────────── */}
          {activeTab === "stats" && (
            <>
              {/* Rating Progression */}
              <Card style={{ marginBottom: 20 }}>
                <SectionLabel>Rating Progression</SectionLabel>
                <RatingChart />
              </Card>

              {/* Win/Loss Breakdown */}
              <Card style={{ marginBottom: 20 }}>
                <SectionLabel>Win / Loss Breakdown</SectionLabel>
                <div style={{ display: "flex", gap: 24 }}>
                  {/* Donut chart */}
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      {/* Background ring */}
                      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-bg-elevated)" strokeWidth="16" />
                      {/* Wins segment (57%) */}
                      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-gold-primary)"
                        strokeWidth="16" strokeDasharray={`${0.57 * 339.3} ${339.3}`}
                        strokeDashoffset="84.8" strokeLinecap="round" />
                      {/* Losses segment (41%) */}
                      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-bg-subtle)"
                        strokeWidth="16" strokeDasharray={`${0.41 * 339.3} ${339.3}`}
                        strokeDashoffset={`${84.8 - 0.57 * 339.3}`} strokeLinecap="round" />
                      {/* Center text */}
                      <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="700"
                        fill="var(--color-text-primary)" fontFamily="var(--font-mono)">57%</text>
                      <text x="70" y="82" textAnchor="middle" fontSize="10"
                        fill="var(--color-text-muted)" fontFamily="var(--font-mono)">Win Rate</text>
                    </svg>
                  </div>

                  {/* Win rate by bucket */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      marginBottom: 12,
                    }}>Win Rate by Opponent Rating</div>
                    {[
                      { bucket: "Sub-1500", rate: "62%", games: "100 / 161" },
                      { bucket: "1500 \u2013 1800", rate: "56%", games: "420 / 748" },
                      { bucket: "1800+", rate: "51%", games: "327 / 641" },
                    ].map((row, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0",
                        borderBottom: i < 2 ? "1px solid var(--color-bg-subtle)" : "none",
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{row.bucket}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{
                            fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)",
                            fontFamily: "var(--font-mono)",
                          }}>{row.rate}</span>
                          <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 6 }}>{row.games}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Error Analysis */}
              <Card style={{ marginBottom: 20 }}>
                <SectionLabel>Error Analysis</SectionLabel>
                <HorizontalBar label="Blunders" count={23} max={156} color="var(--color-danger)" />
                <HorizontalBar label="Mistakes" count={67} max={156} color="var(--color-gold-dark)" />
                <HorizontalBar label="Inaccuracies" count={156} max={156} color="var(--color-text-muted)" />
              </Card>

              {/* PR Trend */}
              <Card>
                <SectionLabel>Performance Rating Trend</SectionLabel>
                <PRTrendChart />
                <div style={{
                  marginTop: 10, fontSize: 11, color: "var(--color-text-secondary)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <ShieldIcon size={12} />
                  Lower PR = better play &middot; You&apos;re improving steadily
                </div>
              </Card>
            </>
          )}

          {/* ─── MATCH HISTORY ─────────────────────────────── */}
          {activeTab === "history" && (
            <Card>
              {/* Filters */}
              <div style={{
                display: "flex", gap: 6, marginBottom: 16,
              }}>
                {HISTORY_FILTERS.map(({ id, label }) => {
                  const active = historyFilter === id;
                  return (
                    <button key={id} onClick={() => setHistoryFilter(id)} style={{
                      padding: "6px 14px", borderRadius: 6,
                      border: `1.5px solid ${active ? "var(--color-gold-primary)" : "var(--color-bg-subtle)"}`,
                      background: active ? "var(--color-gold-primary)" : "var(--color-bg-surface)",
                      color: active ? "var(--color-accent-fg)" : "var(--color-text-secondary)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}>{label}</button>
                  );
                })}
              </div>

              {/* Table header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: "1.5px solid var(--color-bg-subtle)",
                marginBottom: 4,
              }}>
                <div style={{ width: 32 }} />
                <div style={{
                  flex: 1, fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>Opponent</div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 60, textAlign: "center",
                }}>Result</div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 36, textAlign: "right",
                }}>PR</div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 40, textAlign: "right",
                }}>Wager</div>
              </div>

              {/* Rows */}
              <div style={{ maxHeight: 480, overflow: "auto" }}>
                {filteredMatches.map((m, i) => (
                  <ProfileMatchRow key={i} {...m} />
                ))}
              </div>

              {/* Pagination */}
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: "1px solid var(--color-bg-subtle)",
                fontSize: 11, color: "var(--color-text-muted)", textAlign: "center",
              }}>
                Showing {filteredMatches.length} of {PROFILE.totalGames.toLocaleString()} matches
              </div>
            </Card>
          )}

          {/* ─── SETTINGS ──────────────────────────────────── */}
          {activeTab === "settings" && (
            <>
              {/* Account */}
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Account</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
                  }}>Display Name</div>
                  <input
                    type="text" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 6,
                      border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-base)",
                      fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", outline: "none",
                      fontFamily: "var(--font-body)",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--color-gold-primary)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--color-bg-subtle)"; handleDisplayNameBlur(); }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    Email
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 3,
                      background: "var(--color-gold-muted)", color: "var(--color-gold-primary)", fontWeight: 700,
                    }}>Verified</span>
                  </div>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 6,
                      border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-base)",
                      fontSize: 14, color: "var(--color-text-primary)", outline: "none",
                      fontFamily: "var(--font-body)",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--color-gold-primary)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--color-bg-subtle)"; }}
                  />
                </div>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
                  }}>Avatar</div>
                  <button style={{
                    padding: "8px 16px", borderRadius: 6,
                    border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-surface)",
                    fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)",
                    cursor: "pointer", fontFamily: "var(--font-body)",
                  }}>Change Avatar</button>
                </div>
              </Card>

              {/* Appearance */}
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Appearance</SectionLabel>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8,
                }}>Theme</div>
                <SegmentToggle
                  segments={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]}
                  activeId={theme}
                  onSelect={(id) => setTheme(id as "light" | "dark")}
                />
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
                  Applies to the entire application
                </div>
              </Card>

              {/* Game Preferences */}
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Game Preferences</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8,
                  }}>Board Theme</div>
                  <SegmentToggle
                    segments={BOARD_THEMES}
                    activeId={boardTheme}
                    onSelect={setBoardTheme}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8,
                  }}>Notation Style</div>
                  <SegmentToggle
                    segments={NOTATION_STYLES}
                    activeId={notationStyle}
                    onSelect={setNotationStyle}
                  />
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Auto-Confirm Moves</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                      Automatically confirm obvious forced moves
                    </div>
                  </div>
                  <ToggleSwitch on={autoConfirm} onToggle={() => setAutoConfirm(!autoConfirm)} />
                </div>
              </Card>

              {/* Notifications */}
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Notifications</SectionLabel>
                {[
                  { key: "matchInvites" as const, label: "Match Invites", desc: "Get notified when friends challenge you" },
                  { key: "friendRequests" as const, label: "Friend Requests", desc: "Alerts for new friend requests" },
                  { key: "tournamentAlerts" as const, label: "Tournament Alerts", desc: "Upcoming tournament reminders" },
                ].map((item, i) => (
                  <div key={item.key} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: i < 2 ? "1px solid var(--color-bg-subtle)" : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <ToggleSwitch
                      on={notifications[item.key]}
                      onToggle={() => setNotifications({
                        ...notifications,
                        [item.key]: !notifications[item.key],
                      })}
                    />
                  </div>
                ))}
              </Card>

              {/* Wallet */}
              <Card>
                <SectionLabel>Wallet</SectionLabel>

                {/* Balance */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 6,
                  background: "var(--color-bg-base)", border: "1px solid var(--color-bg-subtle)",
                  marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <WalletIcon />
                    <span style={{
                      fontSize: 22, fontWeight: 700, color: "var(--color-gold-primary)",
                      fontFamily: "var(--font-mono)",
                    }}>${walletBalance.toFixed(2)}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>USDC</span>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 10, color: "var(--color-gold-primary)", fontWeight: 600,
                  }}>
                    <ShieldIcon size={12} />
                    On-chain escrow
                  </div>
                </div>

                {/* Deposit / Withdraw */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <button style={{
                    flex: 1, padding: "12px 0", borderRadius: 6,
                    border: "none", background: "var(--color-gold-primary)", color: "var(--color-accent-fg)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}>Deposit USDC</button>
                  <button style={{
                    flex: 1, padding: "12px 0", borderRadius: 6,
                    border: "1.5px solid var(--color-bg-subtle)", background: "var(--color-bg-surface)",
                    color: "var(--color-text-secondary)", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "var(--font-body)",
                  }}>Withdraw</button>
                </div>

                {/* Transaction History */}
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  marginBottom: 8,
                }}>Recent Transactions</div>
                {TRANSACTIONS.map((t, i) => (
                  <TransactionRow key={i} {...t} />
                ))}
                <div style={{
                  marginTop: 10, textAlign: "center",
                }}>
                  <button style={{
                    background: "none", border: "none", fontSize: 11,
                    color: "var(--color-text-secondary)", fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}>View all transactions &rarr;</button>
                </div>
              </Card>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
