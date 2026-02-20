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
import { useAuth } from "@/hooks/useAuth";
import { useSocialContext } from "@/contexts/SocialContext";
import { fetchLeaderboard, fetchFriendsLeaderboard, fetchRank, fetchStats } from "@/lib/api";
import type { LeaderboardEntry, PlayerStats } from "@/lib/api";

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

/* ── Podium Spot ── */
function PodiumSpot({ rank, entry, height }: {
  rank: number; entry: LeaderboardEntry; height: number;
}) {
  const name = entry.displayName || entry.address.slice(0, 12);
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={cn(
        "rounded-full bg-bg-elevated flex items-center justify-center font-bold text-text-secondary shrink-0",
        rank === 1
          ? "w-14 h-14 border-[3px] border-gold-primary text-xl"
          : "w-11 h-11 border-2 border-border-subtle text-base",
      )}>
        {name[0]}
      </div>
      <div className="text-[13px] font-bold text-text-primary mt-2 font-body">{name}</div>
      <div className={cn(
        "text-base font-bold font-mono mt-0.5",
        rank === 1 ? "text-gold-primary" : "text-text-primary",
      )}>
        {entry.rating.toLocaleString()}
      </div>
      <div className="text-[10px] text-text-muted font-mono mt-px">
        PR {"--"} &middot; {entry.totalGames} games
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
          rank === 1 ? "text-[var(--color-text-on-gold)]" : "text-text-secondary",
        )}>
          {rank}
        </span>
      </div>
    </div>
  );
}

/* ── Leaderboard Row ── */
function LeaderboardRow({ entry, isYou }: { entry: LeaderboardEntry; isYou: boolean }) {
  const href = isYou ? "/profile" : `/profile/${entry.address}`;
  const name = entry.displayName || entry.address.slice(0, 12);
  const winRate = entry.totalGames > 0 ? Math.round((entry.wins / entry.totalGames) * 100) : 0;
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
        {entry.rank}
      </span>

      {/* Avatar + online indicator */}
      <div className="relative">
        <Avatar name={name} size="sm" />
        {entry.online && (
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
          <span className="text-[9px] px-1.5 py-px rounded-sm bg-gold-primary text-[var(--color-text-on-gold)] font-bold font-body">
            YOU
          </span>
        )}
      </div>

      {/* Rating */}
      <span className="text-[15px] font-bold font-mono text-text-primary min-w-[50px] text-right tabular-nums">
        {entry.rating.toLocaleString()}
      </span>

      {/* PR */}
      <span className="text-xs font-semibold font-mono text-text-secondary min-w-[32px] text-right tabular-nums">
        {"--"}
      </span>

      {/* Win Rate */}
      <span className="text-xs font-semibold font-mono text-text-secondary min-w-[40px] text-right tabular-nums">
        {winRate}%
      </span>

      {/* Games */}
      <span className="text-[11px] font-mono text-text-muted min-w-[40px] text-right tabular-nums">
        {entry.totalGames.toLocaleString()}
      </span>
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN — LEADERBOARD PAGE
   ════════════════════════════════════════════════════════════════════ */

export default function LeaderboardPage() {
  const router = useRouter();
  const { address } = useAuth();
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("allTime");
  const [sortBy, setSortBy] = useState("rating");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [friendEntries, setFriendEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  useEffect(() => {
    fetchLeaderboard(50).then(data => {
      setGlobalEntries(data.entries);
      setTotalPlayers(data.total);
    }).catch(() => {});
    if (address) {
      fetchFriendsLeaderboard(address).then(data => setFriendEntries(data.entries)).catch(() => {});
      fetchRank(address).then(r => setMyRank(r)).catch(() => {});
      fetchStats(address).then(setMyStats).catch(() => {});
    }
  }, [address]);

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

  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    const combined: LeaderboardEntry[] = [];
    for (const e of [...globalEntries, ...friendEntries]) {
      if (!seen.has(e.address)) {
        seen.add(e.address);
        combined.push(e);
      }
    }
    return combined;
  }, [globalEntries, friendEntries]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allEntries.filter((e) =>
      (e.displayName || e.address).toLowerCase().includes(q)
    ).slice(0, 6);
  }, [search, allEntries]);

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
      const isYou = !!address && p.address === address;
      router.push(isYou ? "/profile" : `/profile/${p.address}`);
      setSearch("");
      searchRef.current?.blur();
    } else if (e.key === "Escape") {
      setSearch("");
      searchRef.current?.blur();
    }
  };

  const players = scope === "global" ? globalEntries : friendEntries;
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  const myWinRate = myStats && myStats.totalGames > 0
    ? Math.round((myStats.wins / myStats.totalGames) * 100)
    : 0;

  const myEntry = address && myStats
    ? {
        rank: myRank ?? 0,
        address,
        displayName: "",
        rating: myStats.rating,
        wins: myStats.wins,
        losses: myStats.losses,
        totalGames: myStats.totalGames,
        online: true,
      } as LeaderboardEntry
    : null;

  const showYouRow = scope === "global" && myEntry && myRank != null && myRank > 3 && !rest.some(e => e.address === address);

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
                  const isYou = !!address && p.address === address;
                  const href = isYou ? "/profile" : `/profile/${p.address}`;
                  const name = p.displayName || p.address.slice(0, 12);
                  const winRate = p.totalGames > 0 ? Math.round((p.wins / p.totalGames) * 100) : 0;
                  return (
                    <Link
                      key={p.address}
                      href={href}
                      onClick={() => { setSearch(""); }}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 transition-colors",
                        i === selectedIdx ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                      )}
                    >
                      <Avatar name={name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-text-primary truncate font-body">
                            {name}
                          </span>
                          {isYou && (
                            <span className="text-[9px] px-1.5 py-px rounded-sm bg-gold-primary text-[var(--color-text-on-gold)] font-bold font-body">
                              YOU
                            </span>
                          )}
                          {p.online && (
                            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono">
                          {p.rating.toLocaleString()} rating &middot; {winRate}% win
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
                        ? "bg-gold-primary text-[var(--color-text-on-gold)] border border-gold-primary"
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
                  entry={top3[1]}
                  height={64}
                />
              )}
              {/* 1st place */}
              {top3[0] && (
                <PodiumSpot
                  rank={1}
                  entry={top3[0]}
                  height={88}
                />
              )}
              {/* 3rd place */}
              {top3[2] && (
                <PodiumSpot
                  rank={3}
                  entry={top3[2]}
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
                <LeaderboardRow key={player.address} entry={player} isYou={!!address && player.address === address} />
              ))}

              {/* Separator gap to "You" row (global only) */}
              {showYouRow && myEntry && (
                <>
                  <div className="flex items-center gap-2.5 px-3.5 py-1.5">
                    <span className="w-7 text-center text-sm text-text-muted tracking-widest font-mono">
                      &middot;&middot;&middot;
                    </span>
                    <div className="flex-1 h-px bg-bg-subtle" />
                  </div>

                  {/* Your rank */}
                  <LeaderboardRow entry={myEntry} isYou={true} />
                </>
              )}
            </div>

            {/* Total players */}
            <div className="mt-2 pt-2.5 border-t border-border-subtle text-[11px] text-text-muted text-center font-mono px-3.5">
              {scope === "global" ? `${totalPlayers.toLocaleString()} active players` : `${friendEntries.length} friends ranked`}
            </div>
          </Card>

          {/* ═══ YOUR RANK SUMMARY ═══ */}
          {myRank != null && myStats && (
            <Card className="!bg-bg-base !border-[1.5px] !border-gold-muted">
              <div className="flex items-center gap-4">
                <span className="text-[32px] font-bold text-gold-primary font-mono min-w-[56px] text-center">
                  #{myRank}
                </span>
                <div className="w-px h-12 bg-bg-subtle" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-text-primary mb-1 font-body">Your Rank</div>
                  <div className="flex gap-4 text-xs text-text-secondary font-body">
                    <span>
                      <strong className="text-text-primary font-mono">{myStats.rating.toLocaleString()}</strong> rating
                    </span>
                    <span>
                      <strong className="text-text-primary font-mono">{"--"}</strong> avg PR
                    </span>
                    <span>
                      <strong className="text-text-primary font-mono">{myWinRate}%</strong> win rate
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-text-secondary text-right font-body">
                  <div className="font-semibold">
                    {scope === "global" && totalPlayers > 0
                      ? `Top ${Math.max(1, Math.round((myRank / totalPlayers) * 100))}%`
                      : scope === "friends" && friendEntries.length > 0
                        ? `Top ${Math.max(1, Math.round((myRank / friendEntries.length) * 100))}%`
                        : "--"}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {scope === "global" ? `of ${totalPlayers.toLocaleString()} players` : `of ${friendEntries.length} friends`}
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
