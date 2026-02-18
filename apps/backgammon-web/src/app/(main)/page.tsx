"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Avatar } from "@/components/ui";
import { useSocialContext } from "@/contexts/SocialContext";

// ── Icons ──────────────────────────────────────────────────────

const Icons = {
  dice: (c = "var(--color-text-muted)") => (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <circle cx="7" cy="7" r="1" fill={c} stroke="none" />
      <circle cx="13" cy="7" r="1" fill={c} stroke="none" />
      <circle cx="10" cy="10" r="1" fill={c} stroke="none" />
      <circle cx="7" cy="13" r="1" fill={c} stroke="none" />
      <circle cx="13" cy="13" r="1" fill={c} stroke="none" />
    </svg>
  ),
  brain: (c = "var(--color-text-muted)") => (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10c0-1.5 1.3-3 3-3s3 1.5 3 3M8 12.5c.6.5 1.3.8 2 .8s1.4-.3 2-.8" strokeLinecap="round" />
    </svg>
  ),
  users: (c = "var(--color-text-muted)") => (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="8" cy="7" r="2.5" />
      <path d="M3 16c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="14" cy="7" r="2" />
      <path d="M14 12c2.2 0 4 1.8 4 4" strokeLinecap="round" />
    </svg>
  ),
  shield: (c = "var(--color-text-muted)") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
      <path d="M6 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (c = "var(--color-text-muted)") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  bell: (c = "var(--color-text-muted)") => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M10 3a5 5 0 015 5c0 4 1.5 5 1.5 5H3.5S5 12 5 8a5 5 0 015-5zM8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" />
    </svg>
  ),
  chevron: (c = "var(--color-text-muted)") => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Inline Stat (wireframe-matching version with sub text) ────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--color-text-muted)",
          marginTop: 2,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 600,
          fontFamily: "var(--font-body)",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-gold-primary)",
            marginTop: 2,
            fontFamily: "var(--font-mono)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Inline MatchRowStyled (wireframe-exact styling) ───────────

function MatchRowStyled({
  opponent,
  result,
  score,
  pr,
  date,
}: {
  opponent: string;
  result: "W" | "L";
  score: string;
  pr: string;
  date: string;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--color-bg-subtle)",
        background: h ? "var(--color-bg-elevated)" : "transparent",
        borderRadius: h ? 6 : 0,
        transition: "all 0.12s ease",
        cursor: "pointer",
        marginLeft: h ? -8 : 0,
        paddingLeft: h ? 8 : 0,
        marginRight: h ? -8 : 0,
        paddingRight: h ? 8 : 0,
      }}
    >
      <Avatar name={opponent} size="xs" online />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          vs {opponent}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-faint)",
            fontFamily: "var(--font-body)",
          }}
        >
          {date}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            color: result === "W" ? "var(--color-success)" : "var(--color-danger)",
            background:
              result === "W" ? "rgba(74,123,82,0.15)" : "rgba(176,64,64,0.15)",
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          {result} {score}
        </span>
        <div
          style={{
            fontSize: 10,
            color: "var(--color-text-faint)",
            marginTop: 2,
            fontFamily: "var(--font-mono)",
          }}
        >
          PR {pr}
        </div>
      </div>
    </div>
  );
}

// ── Inline PlayerRowStyled (wireframe-exact styling) ──────────

function PlayerRowStyled({
  name,
  rating,
  status,
}: {
  name: string;
  rating: string;
  status: "online" | "offline";
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--color-bg-subtle)",
      }}
    >
      <Avatar name={name} size="sm" online={status === "online"} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {rating}
        </div>
      </div>
      <button
        style={{
          padding: "4px 12px",
          borderRadius: 6,
          border: h
            ? "1px solid var(--color-gold-primary)"
            : "1px solid var(--color-bg-subtle)",
          background: h ? "var(--color-gold-muted)" : "transparent",
          fontSize: 11,
          fontWeight: 600,
          color: h ? "var(--color-gold-primary)" : "var(--color-text-muted)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          transition: "all 0.15s ease",
        }}
      >
        Challenge
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const router = useRouter();
  const { displayName, username } = useSocialContext();
  const playerName = displayName || username || "Player";

  return (
    <div className="p-4 md:px-6 lg:px-8 lg:py-6" style={{ width: "100%" }}>
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4" style={{ marginBottom: 28 }}>

        <div>
          <h1
            className="text-xl sm:text-2xl lg:text-[30px]"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Welcome back, {playerName}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              margin: "4px 0 0",
              fontFamily: "var(--font-body)",
            }}
          >
            18,247 players online right now
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Search */}
          <div
            className="hidden md:flex"
            style={{
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              border: "1px solid var(--color-bg-subtle)",
              borderRadius: 6,
              background: "var(--color-bg-surface)",
              cursor: "pointer",
            }}
          >
            {Icons.search("var(--color-text-faint)")}
            <span style={{ fontSize: 13, color: "var(--color-text-faint)" }}>
              Search players...
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--color-text-faint)",
                border: "1px solid var(--color-bg-subtle)",
                borderRadius: 4,
                padding: "1px 6px",
                marginLeft: 8,
                fontFamily: "var(--font-mono)",
              }}
            >
              &#8984;K
            </span>
          </div>

          {/* Bell */}
          <button
            style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              border: "1px solid var(--color-bg-subtle)",
              background: "var(--color-bg-surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {Icons.bell("var(--color-text-muted)")}
            <div
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--color-gold-primary)",
              }}
            />
          </button>

          {/* Wallet */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              border: "1px solid var(--color-bg-subtle)",
              borderRadius: 6,
              background: "var(--color-gold-muted)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--color-gold-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              $124.50
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              USDC
            </span>
          </div>
        </div>
      </header>

      {/* Play Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ marginBottom: 40 }}>

        {/* Quick Match */}
        <Card className="hover:shadow-elevated hover:-translate-y-px transition-all cursor-pointer">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {Icons.dice("var(--color-gold-light)")}
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              Quick Match
            </h3>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-burgundy-light)",
                background: "var(--color-burgundy-faint)",
                padding: "3px 10px",
                borderRadius: 20,
                fontWeight: 600,
                fontFamily: "var(--font-body)",
              }}
            >
              Rated
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Find an opponent at your skill level instantly. Provably fair dice.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {["1pt", "3pt", "5pt", "7pt"].map((len) => (
              <span
                key={len}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--color-bg-subtle)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono)",
                  textAlign: "center",
                }}
              >
                {len}
              </span>
            ))}
          </div>
        </Card>

        {/* Play vs AI */}
        <Card className="hover:shadow-elevated hover:-translate-y-px transition-all cursor-pointer">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {Icons.brain("var(--color-gold-light)")}
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              Play vs AI
            </h3>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Practice against XG-level AI. Choose difficulty from beginner to
            grandmaster.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {["Beginner", "Club", "Expert", "GM"].map((lvl) => (
              <button
                key={lvl}
                onClick={() =>
                  router.push(
                    `/ai-match?difficulty=${lvl.toLowerCase()}`
                  )
                }
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--color-bg-subtle)",
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </Card>

        {/* Play a Friend — spans full width */}
        <Card className="md:col-span-2 hover:shadow-elevated hover:-translate-y-px transition-all cursor-pointer">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {Icons.users("var(--color-gold-light)")}
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              Play a Friend
            </h3>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Create a private game or join one with a code.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push("/create-match")}
              style={{
                flex: 1,
                padding: "14px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-gold-primary)",
                color: "var(--color-accent-fg)",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Create Game &rarr; Get Code
            </button>
            <button
              onClick={() => router.push("/join")}
              style={{
                flex: 1,
                padding: "14px 20px",
                borderRadius: 6,
                border: "1.5px solid var(--color-bg-subtle)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Paste Code &rarr; Join Game
            </button>
          </div>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Stats */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Your Stats
              </h3>
              <button
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-body)",
                }}
              >
                View all {Icons.chevron("var(--color-text-secondary)")}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <Stat label="Rating" value="1,847" sub="↑ 23" />
              <div
                style={{
                  width: 1,
                  background: "var(--color-bg-subtle)",
                }}
              />
              <Stat label="W / L / D" value="847/612/34" />
              <div
                style={{
                  width: 1,
                  background: "var(--color-bg-subtle)",
                }}
              />
              <Stat label="Avg PR" value="5.2" sub="Advanced" />
              <div
                style={{
                  width: 1,
                  background: "var(--color-bg-subtle)",
                }}
              />
              <Stat label="Streak" value="4W" />
            </div>
          </Card>

          {/* Recent Matches */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Recent Matches
              </h3>
              <button
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-body)",
                }}
              >
                Full history {Icons.chevron("var(--color-text-secondary)")}
              </button>
            </div>
            <MatchRowStyled
              opponent="MarcGM"
              result="W"
              score="7-4"
              pr="4.1"
              date="2 hours ago"
            />
            <MatchRowStyled
              opponent="DiceKing99"
              result="L"
              score="3-7"
              pr="6.8"
              date="Yesterday"
            />
            <MatchRowStyled
              opponent="NardePlayer"
              result="W"
              score="7-2"
              pr="3.2"
              date="Yesterday"
            />
            <MatchRowStyled
              opponent="BackgammonPro"
              result="W"
              score="5-3"
              pr="4.9"
              date="2 days ago"
            />
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Provably Fair */}
          <Card
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-burgundy-deep)",
              borderLeft: "3px solid var(--color-burgundy-primary)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {Icons.shield("var(--color-gold-primary)")}
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--color-text-primary)",
                }}
              >
                Provably Fair
              </h3>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                margin: "0 0 12px",
                lineHeight: 1.5,
              }}
            >
              Every dice roll is cryptographically verified. Check any roll
              anytime.
            </p>
            <button
              style={{
                background: "transparent",
                border: "1px solid var(--color-bg-subtle)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Verify past rolls &rarr;
            </button>
          </Card>

          {/* Friends Online */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Friends Online
              </h3>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-faint)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                7
              </span>
            </div>
            <PlayerRowStyled name="MarcGM" rating="2,134" status="online" />
            <PlayerRowStyled
              name="TavlaQueen"
              rating="1,923"
              status="online"
            />
            <PlayerRowStyled
              name="DiceRoller"
              rating="1,756"
              status="online"
            />
            <PlayerRowStyled
              name="BGMaster"
              rating="1,680"
              status="offline"
            />
          </Card>


        </div>
      </div>
    </div>
  );
}
