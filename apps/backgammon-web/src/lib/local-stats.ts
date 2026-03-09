import type { Player } from "@xion-beginner/backgammon-core";
import type { AIDifficulty } from "./ai";

/* ── Types ── */

export interface AIMatchRecord {
  id: string;
  difficulty: AIDifficulty;
  result: "W" | "L";
  resultType: string;
  myColor: Player;
  timestamp: number;
}

export interface LocalStats {
  wins: number;
  losses: number;
  totalGames: number;
  currentStreak: number;
  currentStreakType: "W" | "L" | "";
  matches: AIMatchRecord[];
}

/* ── Storage ── */

const STORAGE_KEY = "backgammon-ai-stats";

function load(): LocalStats {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    return JSON.parse(raw) as LocalStats;
  } catch {
    return empty();
  }
}

function save(stats: LocalStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage full or unavailable
  }
}

function empty(): LocalStats {
  return { wins: 0, losses: 0, totalGames: 0, currentStreak: 0, currentStreakType: "", matches: [] };
}

/* ── Public API ── */

export function getLocalStats(): LocalStats {
  return load();
}

export function recordAIGameResult(
  myColor: Player,
  winner: Player,
  resultType: string,
  difficulty: AIDifficulty,
): void {
  const stats = load();
  const result: "W" | "L" = winner === myColor ? "W" : "L";

  const record: AIMatchRecord = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    difficulty,
    result,
    resultType,
    myColor,
    timestamp: Date.now(),
  };

  if (result === "W") {
    stats.wins++;
    if (stats.currentStreakType === "W") {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
      stats.currentStreakType = "W";
    }
  } else {
    stats.losses++;
    if (stats.currentStreakType === "L") {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
      stats.currentStreakType = "L";
    }
  }

  stats.totalGames++;
  stats.matches.unshift(record);

  // Keep last 100 matches
  if (stats.matches.length > 100) {
    stats.matches = stats.matches.slice(0, 100);
  }

  save(stats);
}

export function getLocalMatches(limit = 20): AIMatchRecord[] {
  return load().matches.slice(0, limit);
}
