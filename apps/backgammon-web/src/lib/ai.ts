import type { BoardState, Move, Player } from "@xion-beginner/backgammon-core";
import { getGnubgMoves, isGnubgReady, preloadGnubg } from "./gnubg";

export type AIDifficulty = "beginner" | "club" | "expert" | "gm";

/* ── GNUBG Difficulty Settings ──
 *
 * Maps our difficulty levels to GNU Backgammon's own skill presets.
 * Difficulty is controlled by two parameters:
 *
 *   plies  — search depth (0 = neural net only, 2 = two-ply lookahead)
 *   noise  — Gaussian perturbation applied to equity scores (higher = weaker)
 *
 * Since the WASM API doesn't expose noise directly, we apply it client-side
 * by perturbing GNUBG's returned equity scores before picking the "best" move.
 *
 * | Level    | GNUBG Preset  | Plies | Noise |
 * |----------|---------------|-------|-------|
 * | beginner | Beginner      | 0     | 0.060 |
 * | club     | Intermediate  | 0     | 0.030 |
 * | expert   | Expert        | 0     | 0.000 |
 * | gm       | World Class   | 2     | 0.000 |
 */

interface DifficultySettings {
  plies: number;
  noise: number;
  cubeful: boolean;
}

const DIFFICULTY_SETTINGS: Record<AIDifficulty, DifficultySettings> = {
  beginner: { plies: 0, noise: 0.060, cubeful: true },
  club:     { plies: 0, noise: 0.030, cubeful: true },
  expert:   { plies: 0, noise: 0.000, cubeful: true },
  gm:       { plies: 2, noise: 0.000, cubeful: true },
};

/**
 * Wait for the GNUBG WASM engine to be ready, with a timeout.
 * Kicks off preloading if not already started.
 */
async function waitForGnubg(timeoutMs = 15_000): Promise<boolean> {
  if (isGnubgReady()) return true;

  preloadGnubg();

  const start = Date.now();
  while (!isGnubgReady() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return isGnubgReady();
}

/* ── Noise Model ── */

/**
 * Apply Gaussian noise to an equity value using Box-Muller transform.
 * This replicates GNUBG's internal noise model: perturb the neural net output
 * with a Gaussian random variable scaled by the noise parameter.
 */
function applyNoise(equity: number, noise: number): number {
  if (noise === 0) return equity;
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return equity + gaussian * noise;
}

/* ── Move Selection ── */

/**
 * Select the AI's move sequence for a given board state and difficulty.
 * Uses GNUBG at the configured ply depth, then applies noise to equity scores.
 * Returns the chosen move sequence, or null if no moves are available.
 */
export async function selectAIMove(
  board: BoardState,
  aiColor: Player,
  movesRemaining: number[],
  difficulty: AIDifficulty,
): Promise<Move[] | null> {
  const ready = await waitForGnubg();
  if (!ready) {
    console.warn("[AI] GNUBG WASM not ready after timeout — no move available");
    return null;
  }

  const settings = DIFFICULTY_SETTINGS[difficulty];
  const dice: [number, number] = [
    movesRemaining[0],
    movesRemaining[movesRemaining.length > 1 ? 1 : 0],
  ];

  let results;
  try {
    results = await getGnubgMoves(board, aiColor, dice, {
      maxMoves: 0, // all candidates
      scoreMoves: true,
      plies: settings.plies,
      cubeful: settings.cubeful,
    });
  } catch (err) {
    console.error("[AI] getGnubgMoves failed:", err);
    return null;
  }

  if (results.length === 0) {
    console.warn("[AI] GNUBG returned 0 results for dice", dice);
    return null;
  }

  const nonEmpty = results.filter((r) => r.moves.length > 0);
  if (nonEmpty.length === 0) return [];

  if (settings.noise === 0) {
    // No noise: deterministic best move (GNUBG returns sorted best-first)
    return nonEmpty[0].moves;
  }

  // Apply noise to equity scores and pick the "best" after perturbation
  let bestIdx = 0;
  let bestEq = -Infinity;
  for (let i = 0; i < nonEmpty.length; i++) {
    const eq = nonEmpty[i].evaluation?.eq ?? 0;
    const perturbed = applyNoise(eq, settings.noise);
    if (perturbed > bestEq) {
      bestEq = perturbed;
      bestIdx = i;
    }
  }

  return nonEmpty[bestIdx].moves;
}

/* ── Doubling Cube Decisions ──
 *
 * We probe the position by asking GNUBG to evaluate a few representative
 * dice rolls and averaging the equity. Noise is applied to the equity
 * estimate so lower-difficulty AIs make suboptimal cube decisions naturally.
 *
 * Doubling theory (money game):
 *   - Double when your equity is ≥ ~0.66
 *   - Accept when opponent's equity ≤ ~0.76 (your equity ≥ -0.74)
 */

/** Single representative dice roll for fast position probing.
 *  Using one average-pip roll keeps cube decisions fast (~1 GNUBG call). */
const PROBE_DICE: [number, number] = [4, 2];

/**
 * Estimate position equity by probing with a few dice rolls.
 * Returns average equity from GNUBG's perspective of the given player,
 * with noise applied to model skill-dependent evaluation errors.
 * Positive = player is ahead, negative = behind.
 *
 * Always uses 0-ply for speed — cube decisions don't need deep search.
 */
async function probeEquity(
  board: BoardState,
  player: Player,
  noise: number,
): Promise<number | null> {
  const ready = await waitForGnubg(5_000);
  if (!ready) return null;

  try {
    const results = await getGnubgMoves(board, player, PROBE_DICE, {
      maxMoves: 1,
      scoreMoves: true,
      plies: 0,
      cubeful: true,
    });
    if (results.length > 0 && results[0].evaluation) {
      return applyNoise(results[0].evaluation.eq, noise);
    }
  } catch {
    // Probe failed
  }

  return null;
}

/**
 * Decide whether the AI should offer a double.
 * Uses GNUBG equity probe with noise — lower skill levels naturally
 * make worse doubling decisions due to noisy equity estimates.
 */
export async function shouldAIDouble(
  board: BoardState,
  aiColor: Player,
  cubeValue: number,
  difficulty: AIDifficulty,
): Promise<boolean> {
  if (cubeValue >= 64) return false;
  if (difficulty === "beginner") return false; // beginners don't double

  const { noise } = DIFFICULTY_SETTINGS[difficulty];
  const equity = await probeEquity(board, aiColor, noise);
  if (equity === null) return false;

  // Optimal doubling point: equity ≥ 0.66
  return equity >= 0.66;
}

/**
 * Decide whether the AI should accept an offered double.
 * Uses GNUBG equity probe with noise — lower skill levels naturally
 * make worse take/drop decisions due to noisy equity estimates.
 */
export async function shouldAIAcceptDouble(
  board: BoardState,
  aiColor: Player,
  cubeValue: number,
  difficulty: AIDifficulty,
): Promise<boolean> {
  const { noise } = DIFFICULTY_SETTINGS[difficulty];
  const equity = await probeEquity(board, aiColor, noise);
  if (equity === null) return true; // accept if we can't evaluate

  // Optimal take point: equity ≥ -0.74
  return equity >= -0.74;
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
