"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@xion-beginner/ui";
import { Header } from "@/components/layout";
import {
  Card,
  Avatar,
  Badge,
  Button,
  SegmentToggle,
  PillGroup,
  SectionLabel,
} from "@/components/ui";

/* ── Constants ── */

const SCOPE_SEGMENTS = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
];

const PERIOD_PILLS = [
  { id: "allTime", label: "All Time" },
  { id: "monthly", label: "This Month" },
  { id: "weekly", label: "This Week" },
];

const SORT_OPTIONS = [
  { id: "rating", label: "Rating" },
  { id: "pr", label: "Best PR" },
  { id: "winRate", label: "Win %" },
  { id: "earnings", label: "Earnings" },
];

/* ── Mock Data ── */

const GLOBAL_PLAYERS = [
  { rank: 1, name: "GammonKing", rating: 2312, pr: 2.1, winRate: 68, games: 4210, online: true },
  { rank: 2, name: "MarcGM", rating: 2134, pr: 2.8, winRate: 65, games: 3847, online: true },
  { rank: 3, name: "CubeQueen", rating: 2089, pr: 3.1, winRate: 63, games: 2956, online: false },
  { rank: 4, name: "BGMaster42", rating: 2045, pr: 3.3, winRate: 62, games: 3102, online: true },
  { rank: 5, name: "DoublingDan", rating: 1998, pr: 3.6, winRate: 60, games: 2714, online: false },
  { rank: 6, name: "TavlaQueen", rating: 1923, pr: 4.0, winRate: 59, games: 2188, online: true },
  { rank: 7, name: "NardePlayer", rating: 1901, pr: 4.2, winRate: 58, games: 1845, online: false },
  { rank: 8, name: "DiceRoller", rating: 1878, pr: 4.5, winRate: 57, games: 2340, online: true },
  { rank: 9, name: "PointBuilder", rating: 1862, pr: 4.7, winRate: 56, games: 1923, online: false },
  { rank: 10, name: "BackgamPro", rating: 1855, pr: 4.8, winRate: 56, games: 1678, online: false },
];

const YOU_GLOBAL = {
  rank: 47, name: "Anthony", rating: 1847, pr: 5.2, winRate: 58, games: 1493, online: true, isYou: true,
};

const FRIEND_PLAYERS = [
  { rank: 1, name: "MarcGM", rating: 2134, pr: 2.8, winRate: 65, games: 3847, online: true },
  { rank: 2, name: "TavlaQueen", rating: 1923, pr: 4.0, winRate: 59, games: 2188, online: true },
  { rank: 3, name: "DiceRoller", rating: 1878, pr: 4.5, winRate: 57, games: 2340, online: true },
  { rank: 4, name: "Anthony", rating: 1847, pr: 5.2, winRate: 58, games: 1493, online: true, isYou: true },
  { rank: 5, name: "BGMaster", rating: 1680, pr: 5.8, winRate: 52, games: 987, online: false },
  { rank: 6, name: "NardePlayer", rating: 1512, pr: 6.4, winRate: 48, games: 654, online: false },
];

/* ── Podium Spot ── */
function PodiumSpot({ rank, name, rating, pr, games, height }: {
  rank: number; name: string; rating: number; pr: number | string; games: number; height: number;
}) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={cn(
        "rounded-full bg-bg-elevated flex items-center justify-center font-bold text-text-secondary shrink-0",
        rank === 1
          ? "w-14 h-14 border-[3px] border-gold-primary text-xl"
          : "w-11 h-11 border-2 border-bg-subtle text-base",
      )}>
        {name[0]}
      </div>
      <div className="text-[13px] font-bold text-text-primary mt-2 font-body">{name}</div>
      <div className={cn(
        "text-base font-bold font-mono mt-0.5",
        rank === 1 ? "text-gold-primary" : "text-text-primary",
      )}>
        {rating.toLocaleString()}
      </div>
      <div className="text-[10px] text-text-muted font-mono mt-px">
        PR {pr} &middot; {games} games
      </div>
      <div
        className={cn(
          "w-full mt-2.5 rounded-t-lg flex items-center justify-center",
          rank === 1
            ? "bg-gradient-to-br from-gold-dark to-gold-primary"
            : rank === 2
              ? "bg-bg-subtle"
              : "bg-bg-elevated",
        )}
        style={{ height }}
      >
        <span className={cn(
          "text-xl font-bold font-mono",
          rank === 1 ? "text-[var(--color-accent-fg)]" : "text-text-secondary",
        )}>
          {rank}
        </span>
      </div>
    </div>
  );
}

/* ── Leaderboard Row ── */
function LeaderboardRow({ rank, name, rating, pr, winRate, games, isYou, online }: {
  rank: number; name: string; rating: number; pr: number; winRate: number; games: number; isYou?: boolean; online?: boolean;
}) {
  const href = isYou ? "/profile" : `/profile/${name.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[var(--radius-button)] mb-0.5 transition-colors hover:bg-bg-elevated",
        isYou ? "bg-bg-base border-[1.5px] border-gold-muted" : "border border-transparent",
      )}
    >
      {/* Rank */}
      <span className={cn(
        "w-7 text-center text-sm font-bold font-mono",
        isYou ? "text-text-primary" : "text-text-secondary",
      )}>
        {rank}
      </span>

      {/* Avatar + online indicator */}
      <div className="relative">
        <Avatar name={name} size="sm" />
        {online && (
          <span className={cn(
            "absolute bottom-0 right-0 w-2 h-2 rounded-full bg-success border-2",
            isYou ? "border-bg-base" : "border-bg-surface",
          )} />
        )}
      </div>

      {/* Name + YOU badge */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className={cn(
          "text-[13px] truncate font-body",
          isYou ? "font-bold" : "font-semibold",
          "text-text-primary",
        )}>
          {name}
        </span>
        {isYou && (
          <span className="text-[9px] px-1.5 py-px rounded-sm bg-gold-primary text-[var(--color-accent-fg)] font-bold font-body">
            YOU
          </span>
        )}
      </div>

      {/* Rating */}
      <span className="text-[15px] font-bold font-mono text-text-primary min-w-[50px] text-right tabular-nums">
        {rating.toLocaleString()}
      </span>

      {/* PR */}
      <span className="text-xs font-semibold font-mono text-text-secondary min-w-[32px] text-right tabular-nums">
        {pr}
      </span>

      {/* Win Rate */}
      <span className="text-xs font-semibold font-mono text-text-secondary min-w-[40px] text-right tabular-nums">
        {winRate}%
      </span>

      {/* Games */}
      <span className="text-[11px] font-mono text-text-muted min-w-[40px] text-right tabular-nums">
        {games.toLocaleString()}
      </span>
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN — LEADERBOARD PAGE
   ════════════════════════════════════════════════════════════════════ */
/* ── All known players for search ── */
const ALL_PLAYERS = [
  ...GLOBAL_PLAYERS,
  YOU_GLOBAL,
  ...FRIEND_PLAYERS.filter(
    (f) => !GLOBAL_PLAYERS.some((g) => g.name === f.name) && f.name !== YOU_GLOBAL.name,
  ),
];

export default function LeaderboardPage() {
  const router = useRouter();
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("allTime");
  const [sortBy, setSortBy] = useState("rating");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return ALL_PLAYERS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search]);

  // Reset selection when results change
  useEffect(() => setSelectedIdx(-1), [searchResults]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIdx >= 0 && searchResults[selectedIdx]) {
      e.preventDefault();
      const p = searchResults[selectedIdx];
      const isYou = "isYou" in p && p.isYou;
      router.push(isYou ? "/profile" : `/profile/${p.name.toLowerCase().replace(/\s+/g, "-")}`);
      setSearch("");
      searchRef.current?.blur();
    } else if (e.key === "Escape") {
      setSearch("");
      searchRef.current?.blur();
    }
  };

  const players = scope === "global" ? GLOBAL_PLAYERS : FRIEND_PLAYERS;
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);
  const youEntry = scope === "global" ? YOU_GLOBAL : FRIEND_PLAYERS.find((p) => p.isYou);
  const yourRank = scope === "global" ? 47 : 4;

  return (
    <div>
      <Header title="Leaderboard" />

      <main className="flex-1 flex flex-col items-center p-4 md:px-6 md:py-7 overflow-auto">
        <div className="w-full max-w-[700px] space-y-5">

          {/* ═══ SEARCH ═══ */}
          <div className="relative">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search players..."
                className="w-full pl-10 pr-14 py-2.5 rounded-[var(--radius-button)] bg-bg-elevated border border-border-subtle text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-gold-primary transition-colors font-body"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded border border-border-subtle">
                {"\u2318"}K
              </kbd>
            </div>

            {/* Autosuggest dropdown */}
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-[var(--radius-card)] bg-bg-elevated border border-border-subtle shadow-elevated overflow-hidden">
                {searchResults.map((p, i) => {
                  const isYou = "isYou" in p && !!(p as typeof YOU_GLOBAL).isYou;
                  const href = isYou ? "/profile" : `/profile/${p.name.toLowerCase().replace(/\s+/g, "-")}`;
                  return (
                    <Link
                      key={p.name}
                      href={href}
                      onClick={() => { setSearch(""); }}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 transition-colors",
                        i === selectedIdx ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                      )}
                    >
                      <Avatar name={p.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-text-primary truncate font-body">
                            {p.name}
                          </span>
                          {isYou && (
                            <span className="text-[9px] px-1.5 py-px rounded-sm bg-gold-primary text-[var(--color-accent-fg)] font-bold font-body">
                              YOU
                            </span>
                          )}
                          {p.online && (
                            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono">
                          {p.rating.toLocaleString()} rating &middot; {p.winRate}% win
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-text-secondary">
                        #{p.rank}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ FILTERS ═══ */}
          <Card>
            {/* Scope toggle */}
            <div className="mb-4">
              <SegmentToggle segments={SCOPE_SEGMENTS} activeId={scope} onSelect={setScope} />
            </div>

            {/* Time period pills */}
            <PillGroup pills={PERIOD_PILLS} activeId={period} onSelect={setPeriod} className="mb-4" />

            {/* Sort by */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.04em] font-body">
                Sort by
              </span>
              <div className="flex gap-1">
                {SORT_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setSortBy(id)}
                    className={cn(
                      "px-2.5 py-1 rounded-[var(--radius-button)] text-[11px] font-semibold cursor-pointer transition-colors",
                      sortBy === id
                        ? "bg-gold-primary text-[var(--color-accent-fg)] border border-gold-primary"
                        : "bg-transparent text-text-muted border border-transparent hover:text-text-secondary",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* ═══ PODIUM (Top 3) ═══ */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 pt-5">
              <SectionLabel>Top Players</SectionLabel>
            </div>
            <div className="flex items-end gap-3 px-6 mt-2">
              {/* 2nd place */}
              {top3[1] && (
                <PodiumSpot
                  rank={2}
                  name={top3[1].name}
                  rating={top3[1].rating}
                  pr={top3[1].pr}
                  games={top3[1].games}
                  height={64}
                />
              )}
              {/* 1st place */}
              {top3[0] && (
                <PodiumSpot
                  rank={1}
                  name={top3[0].name}
                  rating={top3[0].rating}
                  pr={top3[0].pr}
                  games={top3[0].games}
                  height={88}
                />
              )}
              {/* 3rd place */}
              {top3[2] && (
                <PodiumSpot
                  rank={3}
                  name={top3[2].name}
                  rating={top3[2].rating}
                  pr={top3[2].pr}
                  games={top3[2].games}
                  height={48}
                />
              )}
            </div>
          </Card>

          {/* ═══ RANKINGS TABLE ═══ */}
          <Card padding="sm">
            {/* Column headers */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 border-b-[1.5px] border-border-subtle mb-1">
              <span className="w-7 text-center text-[9px] font-bold text-text-muted uppercase tracking-[0.04em] font-mono">
                #
              </span>
              <span className="w-8" />
              <span className="flex-1 text-[9px] font-bold text-text-muted uppercase tracking-[0.04em] font-mono">
                Player
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.04em] font-mono min-w-[50px] text-right",
                sortBy === "rating" ? "text-text-primary" : "text-text-muted",
              )}>
                Rating
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.04em] font-mono min-w-[32px] text-right",
                sortBy === "pr" ? "text-text-primary" : "text-text-muted",
              )}>
                PR
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.04em] font-mono min-w-[40px] text-right",
                sortBy === "winRate" ? "text-text-primary" : "text-text-muted",
              )}>
                Win %
              </span>
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.04em] font-mono min-w-[40px] text-right">
                Games
              </span>
            </div>

            {/* Rows (4th place onward) */}
            <div className="max-h-[440px] overflow-auto">
              {rest.map((player) => (
                <LeaderboardRow key={player.rank} {...player} />
              ))}

              {/* Separator gap to "You" row (global only) */}
              {scope === "global" && (
                <>
                  <div className="flex items-center gap-2.5 px-3.5 py-1.5">
                    <span className="w-7 text-center text-sm text-text-muted tracking-widest font-mono">
                      &middot;&middot;&middot;
                    </span>
                    <div className="flex-1 h-px bg-bg-subtle" />
                  </div>

                  {/* Your rank */}
                  <LeaderboardRow {...YOU_GLOBAL} />
                </>
              )}
            </div>

            {/* Total players */}
            <div className="mt-2 pt-2.5 border-t border-border-subtle text-[11px] text-text-muted text-center font-mono px-3.5">
              {scope === "global" ? "2,847 active players" : `${FRIEND_PLAYERS.length} friends ranked`}
            </div>
          </Card>

          {/* ═══ YOUR RANK SUMMARY ═══ */}
          {youEntry && (
            <Card className="!bg-bg-base !border-[1.5px] !border-gold-muted">
              <div className="flex items-center gap-4">
                <span className="text-[32px] font-bold text-gold-primary font-mono min-w-[56px] text-center">
                  #{yourRank}
                </span>
                <div className="w-px h-12 bg-bg-subtle" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-text-primary mb-1 font-body">Your Rank</div>
                  <div className="flex gap-4 text-xs text-text-secondary font-body">
                    <span>
                      <strong className="text-text-primary font-mono">{youEntry.rating.toLocaleString()}</strong> rating
                    </span>
                    <span>
                      <strong className="text-text-primary font-mono">{youEntry.pr}</strong> avg PR
                    </span>
                    <span>
                      <strong className="text-text-primary font-mono">{youEntry.winRate}%</strong> win rate
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-text-secondary text-right font-body">
                  <div className="font-semibold">Top {scope === "global" ? "2%" : "67%"}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {scope === "global" ? "of 2,847 players" : `of ${FRIEND_PLAYERS.length} friends`}
                  </div>
                </div>
              </div>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
