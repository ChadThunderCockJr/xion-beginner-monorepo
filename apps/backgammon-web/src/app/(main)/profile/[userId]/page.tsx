"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@xion-beginner/ui";
import { Header } from "@/components/layout";
import {
  Card,
  Button,
  StatCell,
  TabBar,
  MatchRow,
  SectionLabel,
  Badge,
} from "@/components/ui";
import { fetchStats, fetchMatches, fetchProfile, timeAgo } from "@/lib/api";
import type { PlayerStats, MatchResult as MatchResultType, PlayerProfile } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { id: "history", label: "Match History" },
  { id: "h2h", label: "Head to Head" },
];

/* ── Quick Stat ── */
function QuickStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center flex-1">
      <div className="text-xl font-bold text-text-primary font-mono tracking-tight">{value}</div>
      <div className="text-[10px] text-text-muted uppercase tracking-[0.04em] font-semibold mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const [activeTab, setActiveTab] = useState("history");
  const { address: myAddress } = useAuth();

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matches, setMatches] = useState<MatchResultType[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    const userId = params.userId;
    fetchProfile(userId).then(setProfile).catch(() => {});
    fetchStats(userId).then(setStats).catch(() => {});
    fetchMatches(userId, 20).then(setMatches).catch(() => {});
  }, [params.userId]);

  const playerName = profile?.displayName || params.userId.slice(0, 12);
  const rating = stats?.rating ?? 1500;
  const ratingChange = stats?.ratingChange ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const totalGames = stats?.totalGames ?? 0;
  const streakStr = stats && stats.currentStreak > 0 ? `${stats.currentStreak}${stats.currentStreakType}` : "--";
  const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "--";
  const winPct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const h2hMatches = matches.filter(m => m.opponent === myAddress);
  const h2hWins = h2hMatches.filter(m => m.result === "L").length;
  const h2hLosses = h2hMatches.filter(m => m.result === "W").length;
  const h2hTotal = h2hMatches.length;
  const h2hWinRate = h2hTotal > 0 ? Math.round((h2hWins / h2hTotal) * 100) : 0;

  return (
    <div>
      <Header
        title={playerName}
        backHref="/leaderboard"
        actions={<Button size="sm">Challenge</Button>}
      />

      <div className="p-6 space-y-0 max-w-[700px]">
        {/* Profile Header */}
        <Card>
          <div className="flex gap-5 items-start">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-bg-elevated border-2 border-bg-subtle flex items-center justify-center text-[30px] font-bold text-text-secondary">
                {playerName[0]}
              </div>
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-success border-[3px] border-bg-surface" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="font-display text-2xl sm:text-[36px] font-bold text-text-primary tracking-tight">{playerName}</span>
                <div className="flex items-baseline gap-1 px-2.5 py-0.5 rounded-[6px] bg-bg-base border border-border-subtle">
                  <span className="text-base font-bold text-text-primary font-mono">{rating.toLocaleString()}</span>
                  <span className={cn("text-[11px] font-bold", ratingChange >= 0 ? "text-success" : "text-danger")}>
                    {ratingChange >= 0 ? "↑" : "↓"}{Math.abs(ratingChange)}
                  </span>
                </div>
              </div>
              <div className="text-[13px] text-text-secondary mb-1.5">{profile?.username ? `@${profile.username}` : "Backgammon player"}</div>
              <div className="text-[11px] text-text-muted">Member since {memberSince}</div>
            </div>
          </div>

          <div className="flex gap-0 mt-5 pt-4 border-t border-border-subtle">
            <QuickStat label="Games" value={totalGames.toLocaleString()} />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="W / L" value={`${wins} / ${losses}`} />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="Avg PR" value="--" />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="Streak" value={streakStr} />
          </div>
        </Card>

        {/* Tab Bar */}
        <Card padding="none" className="!rounded-t-none !border-t-0 mb-5">
          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="px-4" />
        </Card>

        {/* Match History Tab */}
        {activeTab === "history" && (
          <Card>
            {matches.length > 0 ? matches.map((m, i) => (
              <MatchRow
                key={i}
                opponent={m.opponentName || m.opponent.slice(0, 10)}
                result={m.result === "W" ? "win" : "loss"}
                score={m.resultType}
                matchLength={0}
                date={timeAgo(m.timestamp)}
              />
            )) : (
              <div className="text-center text-text-muted text-sm py-5">No matches found</div>
            )}
          </Card>
        )}

        {/* Head to Head Tab */}
        {activeTab === "h2h" && (
          <Card>
            {h2hTotal > 0 ? (
              <>
                <p className="text-sm text-text-secondary mb-4">
                  You&apos;ve played <span className="font-semibold text-text-primary">{h2hTotal} {h2hTotal === 1 ? "match" : "matches"}</span> against {playerName}
                </p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <StatCell label="Your Wins" value={String(h2hWins)} />
                  <StatCell label="Their Wins" value={String(h2hLosses)} />
                  <StatCell label="Win Rate" value={`${h2hWinRate}%`} />
                </div>
                <div className="border-t border-border-subtle pt-2">
                  {h2hMatches.map((m, i) => (
                    <MatchRow
                      key={i}
                      opponent={playerName}
                      result={m.result === "W" ? "loss" : "win"}
                      score={m.resultType}
                      matchLength={0}
                      date={timeAgo(m.timestamp)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-text-muted text-sm py-5">No head-to-head matches yet</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
