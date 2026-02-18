"use client";

import { useState } from "react";
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

const TABS = [
  { id: "history", label: "Match History" },
  { id: "h2h", label: "Head to Head" },
];

const MOCK_PLAYERS: Record<string, { name: string; rating: number; ratingChange: number; wins: number; losses: number; draws: number; totalGames: number; avgPR: number; streak: string; bio: string; joined: string }> = {
  "marcgm": { name: "MarcGM", rating: 2134, ratingChange: 12, wins: 2401, losses: 1446, draws: 87, totalGames: 3847, avgPR: 2.8, streak: "6W", bio: "Tournament player · Top 10 Global", joined: "January 2022" },
  "tavlaqueen": { name: "TavlaQueen", rating: 1923, ratingChange: -8, wins: 1291, losses: 897, draws: 45, totalGames: 2188, avgPR: 4.0, streak: "2L", bio: "Tavla enthusiast from Istanbul", joined: "June 2023" },
  "diceroller": { name: "DiceRoller", rating: 1878, ratingChange: 5, wins: 1334, losses: 1006, draws: 52, totalGames: 2340, avgPR: 4.5, streak: "3W", bio: "Lucky dice, better play", joined: "March 2023" },
};

const MOCK_MATCHES = [
  { opponent: "Anthony", result: "loss" as const, score: "3-5", matchLength: 5, date: "2h ago" },
  { opponent: "Emily Tran", result: "win" as const, score: "5-2", matchLength: 5, date: "6h ago" },
  { opponent: "Jordan Lee", result: "win" as const, score: "7-3", matchLength: 7, date: "1d ago" },
  { opponent: "Alex Murphy", result: "loss" as const, score: "4-5", matchLength: 5, date: "2d ago" },
  { opponent: "Chris Park", result: "win" as const, score: "3-1", matchLength: 3, date: "3d ago" },
];

const H2H_MATCHES = [
  { opponent: "Anthony", result: "loss" as const, score: "3-5", matchLength: 5, date: "2h ago" },
  { opponent: "Anthony", result: "win" as const, score: "5-4", matchLength: 5, date: "3d ago" },
  { opponent: "Anthony", result: "win" as const, score: "7-5", matchLength: 7, date: "1w ago" },
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

  const player = MOCK_PLAYERS[params.userId.toLowerCase()] ?? {
    name: params.userId, rating: 1200, ratingChange: 0, wins: 20, losses: 15, draws: 2,
    totalGames: 37, avgPR: 8.4, streak: "1W", bio: "Backgammon player", joined: "January 2026",
  };

  const winPct = Math.round((player.wins / (player.wins + player.losses)) * 100);

  return (
    <div>
      <Header
        title={player.name}
        backHref="/leaderboard"
        actions={<Button size="sm">Challenge</Button>}
      />

      <div className="p-6 space-y-0 max-w-[700px]">
        {/* Profile Header */}
        <Card>
          <div className="flex gap-5 items-start">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-bg-elevated border-2 border-bg-subtle flex items-center justify-center text-[30px] font-bold text-text-secondary">
                {player.name[0]}
              </div>
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-success border-[3px] border-bg-surface" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="font-display text-2xl sm:text-[36px] font-bold text-text-primary tracking-tight">{player.name}</span>
                <div className="flex items-baseline gap-1 px-2.5 py-0.5 rounded-[6px] bg-bg-base border border-border-subtle">
                  <span className="text-base font-bold text-text-primary font-mono">{player.rating.toLocaleString()}</span>
                  <span className={cn("text-[11px] font-bold", player.ratingChange >= 0 ? "text-success" : "text-danger")}>
                    {player.ratingChange >= 0 ? "↑" : "↓"}{Math.abs(player.ratingChange)}
                  </span>
                </div>
              </div>
              <div className="text-[13px] text-text-secondary mb-1.5">{player.bio}</div>
              <div className="text-[11px] text-text-muted">Member since {player.joined}</div>
            </div>
          </div>

          <div className="flex gap-0 mt-5 pt-4 border-t border-border-subtle">
            <QuickStat label="Games" value={player.totalGames.toLocaleString()} />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="W / L" value={`${player.wins} / ${player.losses}`} sub={`${player.draws} draws`} />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="Avg PR" value={player.avgPR.toFixed(1)} />
            <div className="w-px bg-bg-subtle" />
            <QuickStat label="Streak" value={player.streak} />
          </div>
        </Card>

        {/* Tab Bar */}
        <Card padding="none" className="!rounded-t-none !border-t-0 mb-5">
          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="px-4" />
        </Card>

        {/* Match History Tab */}
        {activeTab === "history" && (
          <Card>
            {MOCK_MATCHES.map((match, i) => (
              <MatchRow key={i} {...match} />
            ))}
          </Card>
        )}

        {/* Head to Head Tab */}
        {activeTab === "h2h" && (
          <Card>
            <p className="text-sm text-text-secondary mb-4">
              You&apos;ve played <span className="font-semibold text-text-primary">3 matches</span> against {player.name}
            </p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatCell label="Your Wins" value="1" />
              <StatCell label="Their Wins" value="2" />
              <StatCell label="Win Rate" value="33%" />
            </div>
            <div className="border-t border-border-subtle pt-2">
              {H2H_MATCHES.map((match, i) => (
                <MatchRow
                  key={i}
                  opponent={player.name}
                  result={match.result === "win" ? "loss" : "win"}
                  score={match.score}
                  matchLength={match.matchLength}
                  date={match.date}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
