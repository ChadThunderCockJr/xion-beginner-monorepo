import type { BoardState, Move, Player } from "@xion-beginner/backgammon-core";
import {
  generateAllMoveSequences,
  applySingleMove,
  getPipCount,
  getBarCount,
  getCheckerCount,
  canBearOff,
  isPointBlocked,
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
    pipCount: 1.5,
    blotPenalty: -5.0,
    hitBonus: 5.0,
    homePoints: 4.0,
    primeLength: 6.0,
    anchor: 3.0,
    bearOffProgress: 3.0,
    backCheckerPenalty: -2.5,
  },
  expert: {
    pipCount: 2.0,
    blotPenalty: -6.0,
    hitBonus: 6.0,
    homePoints: 6.0,
    primeLength: 8.0,
    anchor: 5.0,
    bearOffProgress: 4.0,
    backCheckerPenalty: -4.0,
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

/* ── GM Helpers ── */

/**
 * Count how many of the 36 possible dice outcomes let the opponent hit a blot.
 * Returns a fraction: shots / 36.
 */
function countShots(
  board: BoardState,
  blotPoint: number,
  opponent: Player
): number {
  let shots = 0;

  // Source point at `dist` away from blotPoint in opponent's moving direction
  const getSource = (dist: number): number | null => {
    // White moves from high to low: source is higher than blot
    // Black moves from low to high: source is lower than blot
    const src =
      opponent === "white" ? blotPoint + dist : blotPoint - dist;
    return src >= 1 && src <= 24 ? src : null;
  };

  const hasChecker = (pt: number): boolean =>
    getCheckerCount(board, pt, opponent) > 0;

  // isPointBlocked(board, pt, opponent) = true when the OTHER side has 2+ there
  const isOpen = (pt: number): boolean =>
    pt >= 1 && pt <= 24 && !isPointBlocked(board, pt, opponent);

  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      let canHit = false;

      if (d1 === d2) {
        // Doubles — can reach d, 2d, 3d, 4d
        const d = d1;
        for (let n = 1; n <= 4 && !canHit; n++) {
          const src = getSource(n * d);
          if (src === null || !hasChecker(src)) continue;
          // All intermediate stops must be open
          let pathClear = true;
          for (let step = 1; step < n; step++) {
            const mid = getSource(step * d);
            if (mid === null || !isOpen(mid)) {
              pathClear = false;
              break;
            }
          }
          if (pathClear) canHit = true;
        }
      } else {
        // Direct d1
        const src1 = getSource(d1);
        if (src1 !== null && hasChecker(src1)) canHit = true;

        // Direct d2
        if (!canHit) {
          const src2 = getSource(d2);
          if (src2 !== null && hasChecker(src2)) canHit = true;
        }

        // Combined d1+d2 (indirect — need one intermediate open)
        if (!canHit) {
          const srcC = getSource(d1 + d2);
          if (srcC !== null && hasChecker(srcC)) {
            // Path via d1 first: intermediate at blotPoint + d2 / blotPoint - d2
            const mid1 = getSource(d2);
            // Path via d2 first: intermediate at blotPoint + d1 / blotPoint - d1
            const mid2 = getSource(d1);
            if (
              (mid1 !== null && isOpen(mid1)) ||
              (mid2 !== null && isOpen(mid2))
            ) {
              canHit = true;
            }
          }
        }
      }

      if (canHit) shots++;
    }
  }

  return shots / 36;
}

/** Detect the game phase for evaluation weight selection */
function detectPhase(
  board: BoardState,
  player: Player
): "contact" | "race" | "bearoff" {
  const opponent: Player = player === "white" ? "black" : "white";

  if (canBearOff(board, player) && canBearOff(board, opponent)) {
    return "bearoff";
  }

  // Find each side's furthest-back checker
  let furthestWhite = 0;
  let furthestBlack = 25;

  if (board.points[0] > 0) {
    furthestWhite = 25; // white on bar
  } else {
    for (let i = 24; i >= 1; i--) {
      if (board.points[i] > 0) {
        furthestWhite = i;
        break;
      }
    }
  }

  if (board.points[25] < 0) {
    furthestBlack = 0; // black on bar
  } else {
    for (let i = 1; i <= 24; i++) {
      if (board.points[i] < 0) {
        furthestBlack = i;
        break;
      }
    }
  }

  // No contact if white's back checker is already past black's back checker
  if (furthestWhite < furthestBlack) {
    return "race";
  }

  return "contact";
}

/**
 * Rich positional evaluation used exclusively for GM difficulty.
 * Phase-aware with shot counting, prime detection, trapping, and key-point bonuses.
 */
function evaluateBoardGM(board: BoardState, aiColor: Player): number {
  const opponent: Player = aiColor === "white" ? "black" : "white";
  const phase = detectPhase(board, aiColor);

  let score = 0;

  // ── Pip count advantage (lower is better → positive score for AI) ──
  const aiPips = getPipCount(board, aiColor);
  const opPips = getPipCount(board, opponent);
  score += (opPips - aiPips) * (phase === "contact" ? 1.5 : 3.0);

  // ── Bearing-off progress (always relevant) ──
  const borneOff = aiColor === "white" ? board.whiteOff : board.blackOff;
  score += borneOff * 6.0;

  if (phase === "contact") {
    // Shot vulnerability — THE key feature
    for (let i = 1; i <= 24; i++) {
      if (getCheckerCount(board, i, aiColor) === 1) {
        score += -12.0 * countShots(board, i, opponent);
      }
    }

    // Bar penalties
    score += getBarCount(board, aiColor) * -20.0;
    score += getBarCount(board, opponent) * 10.0;

    // Home board points made
    const homeStart = aiColor === "white" ? 1 : 19;
    const homeEnd = aiColor === "white" ? 6 : 24;
    for (let i = homeStart; i <= homeEnd; i++) {
      if (getCheckerCount(board, i, aiColor) >= 2) {
        score += 6.0;
      }
    }

    // Key-point bonuses (own 5-pt, bar-pt, 4-pt)
    const fivePt = aiColor === "white" ? 5 : 20;
    const barPt = aiColor === "white" ? 7 : 18;
    const fourPt = aiColor === "white" ? 4 : 21;
    if (getCheckerCount(board, fivePt, aiColor) >= 2) score += 12.0;
    if (getCheckerCount(board, barPt, aiColor) >= 2) score += 8.0;
    if (getCheckerCount(board, fourPt, aiColor) >= 2) score += 6.0;

    // Prime length — scan for longest run of consecutive made points
    let maxPrime = 0;
    let curPrime = 0;
    for (let i = 1; i <= 24; i++) {
      if (getCheckerCount(board, i, aiColor) >= 2) {
        curPrime++;
        if (curPrime > maxPrime) maxPrime = curPrime;
      } else {
        curPrime = 0;
      }
    }
    if (maxPrime >= 3) {
      score += (maxPrime - 2) * (maxPrime - 2) * 8.0;
    }

    // Trapped checkers behind opponent's prime
    let opCur = 0;
    let opBestLen = 0;
    let opBestStart = 0;
    let opBestEnd = 0;
    let opRunStart = 0;
    for (let i = 1; i <= 24; i++) {
      if (getCheckerCount(board, i, opponent) >= 2) {
        if (opCur === 0) opRunStart = i;
        opCur++;
        if (opCur > opBestLen) {
          opBestLen = opCur;
          opBestStart = opRunStart;
          opBestEnd = i;
        }
      } else {
        opCur = 0;
      }
    }
    if (opBestLen >= 3) {
      let trapped = 0;
      if (aiColor === "white") {
        // White moves toward 1; behind the prime = higher point numbers
        for (let i = opBestEnd + 1; i <= 24; i++) {
          trapped += getCheckerCount(board, i, aiColor);
        }
        trapped += getBarCount(board, aiColor);
      } else {
        // Black moves toward 24; behind the prime = lower point numbers
        for (let i = 1; i < opBestStart; i++) {
          trapped += getCheckerCount(board, i, aiColor);
        }
        trapped += getBarCount(board, aiColor);
      }
      score += -8.0 * trapped * opBestLen;
    }

    // Stack penalty (4+ checkers on a single point)
    for (let i = 1; i <= 24; i++) {
      const c = getCheckerCount(board, i, aiColor);
      if (c > 3) score += -3.5 * (c - 3);
    }

    // Anchors in opponent's home board
    const opHomeStart = opponent === "white" ? 1 : 19;
    const opHomeEnd = opponent === "white" ? 6 : 24;
    for (let i = opHomeStart; i <= opHomeEnd; i++) {
      if (getCheckerCount(board, i, aiColor) >= 2) {
        score += 7.0;
      }
    }

    // Back checker penalty (AI checkers in opponent's home quadrant)
    if (aiColor === "white") {
      for (let i = 19; i <= 24; i++) {
        score += getCheckerCount(board, i, aiColor) * -4.0;
      }
    } else {
      for (let i = 1; i <= 6; i++) {
        score += getCheckerCount(board, i, aiColor) * -4.0;
      }
    }
  } else {
    // ── Race / Bear-off phase ──
    // Pip count & bear-off progress already scored above.

    if (phase === "bearoff") {
      // Distribution penalty — gaps in home board waste rolls
      const homeStart = aiColor === "white" ? 1 : 19;
      const homeEnd = aiColor === "white" ? 6 : 24;
      for (let i = homeStart; i <= homeEnd; i++) {
        if (getCheckerCount(board, i, aiColor) === 0) score += -4.0;
      }
      // Wastage — stacks that can't all bear off on one roll
      for (let i = homeStart; i <= homeEnd; i++) {
        if (getCheckerCount(board, i, aiColor) >= 4) score += -2.0;
      }
    } else {
      // Pure race — penalise stacking
      for (let i = 1; i <= 24; i++) {
        const c = getCheckerCount(board, i, aiColor);
        if (c > 3) score += -2.5 * (c - 3);
      }
    }
  }

  return score;
}

/**
 * Select the AI's move sequence for a given board state and difficulty.
 * Uses the GNU Backgammon WASM engine when available, with difficulty-based
 * randomization among candidates. Falls back to heuristic if WASM isn't ready.
 * Returns the chosen move sequence, or null if no moves are available.
 */
export async function selectAIMove(
  board: BoardState,
  aiColor: Player,
  movesRemaining: number[],
  difficulty: AIDifficulty
): Promise<Move[] | null> {
  // GM always uses the heuristic with 1-ply minimax — GNUBG's single-move
  // answer has no lookahead and plays weaker than our evaluation + search.
  if (difficulty === "gm") {
    return selectHeuristicMove(board, aiColor, movesRemaining, difficulty);
  }

  if (isGnubgReady()) {
    try {
      const dice: [number, number] = [
        movesRemaining[0],
        movesRemaining[movesRemaining.length > 1 ? 1 : 0],
      ];

      // Other difficulties: get all scored candidates, then pick with randomization
      const results = await getGnubgMoves(board, aiColor, dice, {
        maxMoves: 0, // all moves
        scoreMoves: true,
      });

      if (results.length > 0) {
        const nonEmpty = results.filter((r) => r.moves.length > 0);
        if (nonEmpty.length === 0) return [];

        // Beginner: pick uniformly at random from all candidates
        if (difficulty === "beginner") {
          return nonEmpty[Math.floor(Math.random() * nonEmpty.length)].moves;
        }

        // Expert: deterministic — always pick the best move
        if (difficulty === "expert") {
          return nonEmpty[0].moves;
        }

        // Club: weighted random from top 5 using equity
        const candidates = nonEmpty.slice(0, Math.min(5, nonEmpty.length));

        const bestEq = candidates[0].evaluation?.eq ?? 0;
        const adjusted = candidates.map((c) => {
          const eq = c.evaluation?.eq ?? 0;
          return { moves: c.moves, weight: Math.max(0.1, 1 - Math.abs(bestEq - eq)) };
        });
        const totalWeight = adjusted.reduce((sum, c) => sum + c.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const c of adjusted) {
          roll -= c.weight;
          if (roll <= 0) return c.moves;
        }
        return candidates[0].moves;
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

  // ── GM path: rich evaluation + 1-ply look-ahead (top 8) ──
  if (difficulty === "gm") {
    return selectMinimaxMove(board, aiColor, nonEmpty, 8, 0.2);
  }

  // ── Expert path: 1-ply minimax with fewer candidates (top 3) ──
  if (difficulty === "expert") {
    return selectMinimaxMove(board, aiColor, nonEmpty, 3, 0.3);
  }

  // ── Club path: static heuristic, weighted random from top 3 ──
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

  // Club: weighted random from top 3
  const candidates = scored.slice(0, Math.min(3, scored.length));

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

/* ── 21 distinct dice rolls with probability weights (total = 36) ── */
const DICE_ROLLS: [number, number, number][] = [];
for (let d1 = 1; d1 <= 6; d1++) {
  for (let d2 = d1; d2 <= 6; d2++) {
    DICE_ROLLS.push([d1, d2, d1 === d2 ? 1 : 2]);
  }
}

/**
 * Minimax move selection: static GM eval → pick top N → 1-ply minimax re-score.
 * Used by GM (topN=8, staticWeight=0.2) and Expert (topN=3, staticWeight=0.3).
 */
function selectMinimaxMove(
  board: BoardState,
  aiColor: Player,
  candidates: Move[][],
  topN: number,
  staticWeight: number
): Move[] {
  const opponent: Player = aiColor === "white" ? "black" : "white";

  // Static scoring with evaluateBoardGM
  const scored = candidates.map((seq) => {
    let resultBoard = board;
    for (const move of seq) {
      resultBoard = applySingleMove(resultBoard, aiColor, move.from, move.to);
    }
    return { seq, staticScore: evaluateBoardGM(resultBoard, aiColor), resultBoard };
  });

  scored.sort((a, b) => b.staticScore - a.staticScore);

  // 1-ply look-ahead on top N
  const top = scored.slice(0, Math.min(topN, scored.length));

  let bestSeq = top[0].seq;
  let bestFinal = -Infinity;

  for (const { seq, staticScore, resultBoard } of top) {
    let weightedSum = 0;

    for (const [d1, d2, weight] of DICE_ROLLS) {
      const oppDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
      const oppSeqs = generateAllMoveSequences(resultBoard, opponent, oppDice);

      // Opponent picks the move that is worst for AI (minimax)
      let worstForAI = Infinity;

      if (oppSeqs.length === 0) {
        worstForAI = evaluateBoardGM(resultBoard, aiColor);
      } else {
        for (const oppSeq of oppSeqs) {
          let oppBoard = resultBoard;
          for (const m of oppSeq) {
            oppBoard = applySingleMove(oppBoard, opponent, m.from, m.to);
          }
          const v = evaluateBoardGM(oppBoard, aiColor);
          if (v < worstForAI) worstForAI = v;
        }
      }

      weightedSum += worstForAI * weight;
    }

    const onePly = weightedSum / 36;
    const finalScore = staticWeight * staticScore + (1 - staticWeight) * onePly;

    if (finalScore > bestFinal) {
      bestFinal = finalScore;
      bestSeq = seq;
    }
  }

  return bestSeq;
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

  const opponentColor: Player = aiColor === "white" ? "black" : "white";

  // GM uses its own richer evaluation with a higher bar
  if (difficulty === "gm") {
    const advantage =
      evaluateBoardGM(board, aiColor) - evaluateBoardGM(board, opponentColor);
    return advantage > 12;
  }

  const weights = WEIGHTS[difficulty];
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

  const opponentColor: Player = aiColor === "white" ? "black" : "white";

  // GM uses richer evaluation — accept unless position is near hopeless
  if (difficulty === "gm") {
    const disadvantage =
      evaluateBoardGM(board, opponentColor) - evaluateBoardGM(board, aiColor);
    return disadvantage < 18;
  }

  const weights = WEIGHTS[difficulty];
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
