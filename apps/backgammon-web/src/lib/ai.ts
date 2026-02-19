import type { BoardState, Move, Player } from "@xion-beginner/backgammon-core";
import {
  generateAllMoveSequences,
  applySingleMove,
  getPipCount,
  getBarCount,
  getCheckerCount,
  canBearOff,
} from "@xion-beginner/backgammon-core";
import { getGnubgMoves, isGnubgReady } from "./gnubg";

export type AIDifficulty = "beginner" | "club" | "expert" | "gm";

export interface EvalWeights {
  pipCount: number;
  blotPenalty: number;
  hitBonus: number;
  homePoints: number;
  primeLength: number;
  anchor: number;
  bearOffProgress: number;
  backCheckerPenalty: number;
}

export const WEIGHTS: Record<AIDifficulty, EvalWeights> = {
  beginner: {
    pipCount: 0,
    blotPenalty: 0,
    hitBonus: 0,
    homePoints: 0,
    primeLength: 0,
    anchor: 0,
    bearOffProgress: 0,
    backCheckerPenalty: 0,
  },
  club: {
    pipCount: 1.0,
    blotPenalty: -3.0,
    hitBonus: 4.0,
    homePoints: 3.0,
    primeLength: 4.0,
    anchor: 2.0,
    bearOffProgress: 2.0,
    backCheckerPenalty: -1.5,
  },
  expert: {
    pipCount: 1.5,
    blotPenalty: -5.0,
    hitBonus: 5.0,
    homePoints: 5.0,
    primeLength: 7.0,
    anchor: 4.0,
    bearOffProgress: 3.0,
    backCheckerPenalty: -3.0,
  },
  gm: {
    pipCount: 2.0,
    blotPenalty: -6.0,
    hitBonus: 6.0,
    homePoints: 6.0,
    primeLength: 10.0,
    anchor: 5.0,
    bearOffProgress: 4.0,
    backCheckerPenalty: -4.0,
  },
};

export function evaluateBoard(
  board: BoardState,
  aiColor: Player,
  weights: EvalWeights
): number {
  const opponentColor: Player = aiColor === "white" ? "black" : "white";
  let score = 0;

  // Pip count advantage (lower is better for AI)
  const aiPips = getPipCount(board, aiColor);
  const opPips = getPipCount(board, opponentColor);
  score += (opPips - aiPips) * weights.pipCount;

  // Blot penalty (exposed single AI checkers)
  const aiHomeStart = aiColor === "white" ? 1 : 19;
  const aiHomeEnd = aiColor === "white" ? 6 : 24;
  for (let i = 1; i <= 24; i++) {
    const count = getCheckerCount(board, i, aiColor);
    if (count === 1) {
      // Blots in opponent's home board are more dangerous
      const opHomeStart = opponentColor === "white" ? 1 : 19;
      const opHomeEnd = opponentColor === "white" ? 6 : 24;
      const dangerMultiplier =
        i >= opHomeStart && i <= opHomeEnd ? 2.0 : 1.0;
      score += weights.blotPenalty * dangerMultiplier;
    }
  }

  // Hit bonus (opponent checkers on bar)
  const opBar = getBarCount(board, opponentColor);
  score += opBar * weights.hitBonus;

  // Home board points made (2+ checkers)
  for (let i = aiHomeStart; i <= aiHomeEnd; i++) {
    if (getCheckerCount(board, i, aiColor) >= 2) {
      score += weights.homePoints;
    }
  }

  // Prime length (consecutive blocked points)
  let maxPrime = 0;
  let currentPrime = 0;
  for (let i = 1; i <= 24; i++) {
    if (getCheckerCount(board, i, aiColor) >= 2) {
      currentPrime++;
      maxPrime = Math.max(maxPrime, currentPrime);
    } else {
      currentPrime = 0;
    }
  }
  if (maxPrime >= 3) {
    score += (maxPrime - 2) * weights.primeLength;
  }

  // Anchors in opponent's home board
  const opHome = opponentColor === "white" ? [1, 6] : [19, 24];
  for (let i = opHome[0]; i <= opHome[1]; i++) {
    if (getCheckerCount(board, i, aiColor) >= 2) {
      score += weights.anchor;
    }
  }

  // Bearing off progress
  const borneOff = aiColor === "white" ? board.whiteOff : board.blackOff;
  score += borneOff * weights.bearOffProgress;

  // Back checker penalty (checkers far from home)
  if (aiColor === "white") {
    for (let i = 19; i <= 24; i++) {
      const count = getCheckerCount(board, i, aiColor);
      if (count > 0) score += count * weights.backCheckerPenalty;
    }
  } else {
    for (let i = 1; i <= 6; i++) {
      const count = getCheckerCount(board, i, aiColor);
      if (count > 0) score += count * weights.backCheckerPenalty;
    }
  }

  return score;
}

/**
 * Select the AI's move sequence for a given board state and difficulty.
 * For GM difficulty, uses the GNU Backgammon WASM engine when available.
 * Returns the chosen move sequence, or null if no moves are available.
 */
export async function selectAIMove(
  board: BoardState,
  aiColor: Player,
  movesRemaining: number[],
  difficulty: AIDifficulty
): Promise<Move[] | null> {
  // GM difficulty: try WASM engine first
  if (difficulty === "gm" && isGnubgReady()) {
    try {
      const dice: [number, number] = [
        movesRemaining[0],
        movesRemaining[movesRemaining.length > 1 ? 1 : 0],
      ];
      const results = await getGnubgMoves(board, aiColor, dice, {
        maxMoves: 1,
        scoreMoves: false,
      });
      if (results.length > 0 && results[0].moves.length > 0) {
        return results[0].moves;
      }
    } catch {
      // Fall through to heuristic
    }
  }

  return selectHeuristicMove(board, aiColor, movesRemaining, difficulty);
}

/** Heuristic-based move selection (used for beginner/club/expert and as GM fallback) */
function selectHeuristicMove(
  board: BoardState,
  aiColor: Player,
  movesRemaining: number[],
  difficulty: AIDifficulty
): Move[] | null {
  const sequences = generateAllMoveSequences(board, aiColor, movesRemaining);
  if (sequences.length === 0) return null;

  // Filter to only non-empty sequences; if all empty, return empty
  const nonEmpty = sequences.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return [];

  // Beginner: random
  if (difficulty === "beginner") {
    return nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
  }

  const weights = WEIGHTS[difficulty];

  // Score each sequence by simulating all moves
  const scored = nonEmpty.map((seq) => {
    let resultBoard = board;
    for (const move of seq) {
      resultBoard = applySingleMove(resultBoard, aiColor, move.from, move.to);
    }
    return { seq, score: evaluateBoard(resultBoard, aiColor, weights) };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "gm") {
    return scored[0].seq;
  }

  // Weighted random selection from top candidates
  let candidates: typeof scored;
  if (difficulty === "expert") {
    candidates = scored.slice(0, Math.min(3, scored.length));
  } else {
    // club: top 50%
    candidates = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2)));
  }

  // Weighted random: higher scores are more likely
  const minScore = candidates[candidates.length - 1].score;
  const adjusted = candidates.map((c) => ({
    ...c,
    weight: c.score - minScore + 1,
  }));
  const totalWeight = adjusted.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const c of adjusted) {
    roll -= c.weight;
    if (roll <= 0) return c.seq;
  }

  return candidates[0].seq;
}

/**
 * Decide whether the AI should offer a double.
 * Evaluates the board for both sides and checks if advantage exceeds
 * a difficulty-based threshold.
 */
export function shouldAIDouble(
  board: BoardState,
  aiColor: Player,
  cubeValue: number,
  difficulty: AIDifficulty
): boolean {
  if (cubeValue >= 64) return false;
  if (difficulty === "beginner") return false;

  const weights = WEIGHTS[difficulty];
  const opponentColor: Player = aiColor === "white" ? "black" : "white";
  const aiScore = evaluateBoard(board, aiColor, weights);
  const opScore = evaluateBoard(board, opponentColor, weights);
  const advantage = aiScore - opScore;

  const thresholds: Record<AIDifficulty, number> = {
    beginner: Infinity,
    club: 15,
    expert: 10,
    gm: 6,
  };

  return advantage > thresholds[difficulty];
}

/**
 * Decide whether the AI should accept an offered double.
 * Returns true if the position isn't too bad.
 */
export function shouldAIAcceptDouble(
  board: BoardState,
  aiColor: Player,
  cubeValue: number,
  difficulty: AIDifficulty
): boolean {
  if (difficulty === "beginner") return true;

  const weights = WEIGHTS[difficulty];
  const opponentColor: Player = aiColor === "white" ? "black" : "white";
  const aiScore = evaluateBoard(board, aiColor, weights);
  const opScore = evaluateBoard(board, opponentColor, weights);
  const disadvantage = opScore - aiScore;

  const thresholds: Record<AIDifficulty, number> = {
    beginner: Infinity,
    club: 20,
    expert: 15,
    gm: 10,
  };

  return disadvantage <= thresholds[difficulty];
}

/** Get a random thinking delay in ms for the given difficulty */
export function getThinkingDelay(difficulty: AIDifficulty): number {
  const ranges: Record<AIDifficulty, [number, number]> = {
    beginner: [400, 800],
    club: [600, 1200],
    expert: [800, 1600],
    gm: [1000, 2000],
  };
  const [min, max] = ranges[difficulty];
  return min + Math.random() * (max - min);
}
