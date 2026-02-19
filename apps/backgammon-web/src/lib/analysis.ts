import type { BoardState, Move, Player } from "@xion-beginner/backgammon-core";
import {
  createInitialBoard,
  generateAllMoveSequences,
  applySingleMove,
} from "@xion-beginner/backgammon-core";
import { evaluateBoard, WEIGHTS } from "./ai";
import { getGnubgMoves, isGnubgReady, type GnubgMoveResult } from "./gnubg";

/* ── Types ── */

export type ErrorClass = "blunder" | "mistake" | "inaccuracy" | null;

export interface WinProbability {
  win: number;
  winG: number;
  winBG: number;
  lose: number;
  loseG: number;
  loseBG: number;
}

export interface CandidateMove {
  moves: Move[];
  notation: string;
  equity: number; // normalized [-1, +1] from white's perspective
  isPlayed: boolean;
  probability?: WinProbability;
}

export interface TurnAnalysis {
  turnNumber: number;
  player: Player;
  dice: [number, number];
  playedMoves: Move[];
  playedNotation: string;
  equityAfter: number; // equity after played move (white's perspective)
  bestEquity: number; // equity of best candidate (white's perspective)
  equityLoss: number; // always >= 0, from the moving player's perspective
  errorClass: ErrorClass;
  candidates: CandidateMove[]; // top 5, sorted best-first
  boardBefore: BoardState; // board state before this turn's moves
  probability?: WinProbability; // gnubg win probability for played move
}

export interface PlayerSummary {
  totalTurns: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  avgEquityLoss: number;
  performanceRating: number; // 0-100
}

export interface GameAnalysis {
  turns: TurnAnalysis[];
  equityHistory: number[]; // index 0 = initial position, then one per turn
  whiteSummary: PlayerSummary;
  blackSummary: PlayerSummary;
}

export interface TurnRecord {
  player: Player;
  dice: [number, number];
  moves: { from: number; to: number; die: number }[];
  boardBefore?: BoardState;
}

/* ── Helpers ── */

const GM_WEIGHTS = WEIGHTS.gm;

/** Normalize raw eval score to [-1, +1] range.
 *  Divisor of 150 prevents saturation — with GM weights, raw scores
 *  can reach ±200, and backgammon's dice variance means even losing
 *  positions retain meaningful winning chances. */
function normalize(rawScore: number): number {
  return Math.tanh(rawScore / 150);
}

/** Evaluate position from white's perspective (normalized) */
function evalWhite(board: BoardState): number {
  const whiteScore = evaluateBoard(board, "white", GM_WEIGHTS);
  return normalize(whiteScore);
}

/** Evaluate position from a player's own perspective (raw, for ranking) */
function evalPlayer(board: BoardState, player: Player): number {
  return evaluateBoard(board, player, GM_WEIGHTS);
}

/** Format a move sequence into notation like "13/7 8/5" */
function formatNotation(moves: Move[]): string {
  if (moves.length === 0) return "(no moves)";
  return moves.map((m) => `${m.from}/${m.to}`).join(" ");
}

/** Classify equity loss into error category */
function classifyError(equityLoss: number): ErrorClass {
  if (equityLoss >= 0.12) return "blunder";
  if (equityLoss >= 0.06) return "mistake";
  if (equityLoss >= 0.02) return "inaccuracy";
  return null;
}

/** Compute performance rating from average equity loss */
function computePerformanceRating(avgEquityLoss: number): number {
  return Math.round(100 * Math.exp(-avgEquityLoss * 25));
}

/** Apply a full sequence of moves to a board */
function applyMoveSequence(
  board: BoardState,
  player: Player,
  moves: Move[]
): BoardState {
  let result = board;
  for (const move of moves) {
    result = applySingleMove(result, player, move.from, move.to);
  }
  return result;
}

/** Build dice array for generateAllMoveSequences (handles doubles) */
function buildDiceArray(dice: [number, number]): number[] {
  if (dice[0] === dice[1]) {
    return [dice[0], dice[0], dice[0], dice[0]];
  }
  return [dice[0], dice[1]];
}

/* ── Monte Carlo Win Probability ── */

/**
 * Estimate winning probability by simulating random games from a position.
 * Rolls random dice, picks random legal moves for both sides, counts outcomes.
 * Returns { white: number, black: number } as percentages (0-100).
 */
export function estimateWinProbability(
  board: BoardState,
  nextPlayer: Player,
  samples: number = 150
): { white: number; black: number } {
  let whiteWins = 0;

  for (let i = 0; i < samples; i++) {
    let sim = board;
    let player = nextPlayer;
    let moves = 0;
    const maxMoves = 150;

    while (moves < maxMoves) {
      if (sim.whiteOff >= 15) { whiteWins++; break; }
      if (sim.blackOff >= 15) { break; }

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const diceArr = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];

      const seqs = generateAllMoveSequences(sim, player, diceArr);
      const nonEmpty = seqs.filter((s) => s.length > 0);

      if (nonEmpty.length > 0) {
        const chosen = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
        for (const m of chosen) {
          sim = applySingleMove(sim, player, m.from, m.to);
        }
      }

      player = player === "white" ? "black" : "white";
      moves++;
    }
  }

  const whitePct = Math.round((whiteWins / samples) * 100);
  return { white: whitePct, black: 100 - whitePct };
}

/* ── Core Analysis ── */

export function analyzeGame(turnHistory: TurnRecord[]): GameAnalysis {
  let board = createInitialBoard();
  const equityHistory: number[] = [evalWhite(board)];
  const turns: TurnAnalysis[] = [];

  for (let i = 0; i < turnHistory.length; i++) {
    const turn = turnHistory[i];
    const { player, dice, moves: playedMoves } = turn;
    const diceArray = buildDiceArray(dice);

    // Use stored board state if available (prevents replay divergence)
    if (turn.boardBefore) {
      board = turn.boardBefore;
    }

    // Generate all candidate move sequences
    const allSequences = generateAllMoveSequences(board, player, diceArray);

    // Canonical key for the played move
    const playedKey = playedMoves.map((m) => `${m.from}/${m.to}`).sort().join(" ");

    // Track player-perspective score alongside white equity
    const candidatesWithScore: (CandidateMove & { playerScore: number })[] = [];

    if (allSequences.length === 0 || (allSequences.length === 1 && allSequences[0].length === 0)) {
      // No legal moves (forced pass)
      candidatesWithScore.push({
        moves: [],
        notation: "(no moves)",
        equity: evalWhite(board),
        isPlayed: playedMoves.length === 0,
        playerScore: evalPlayer(board, player),
      });
    } else {
      for (const seq of allSequences) {
        const resultBoard = applyMoveSequence(board, player, seq);
        const key = seq.map((m) => `${m.from}/${m.to}`).sort().join(" ");
        candidatesWithScore.push({
          moves: seq,
          notation: formatNotation(seq),
          equity: evalWhite(resultBoard),
          isPlayed: key === playedKey,
          playerScore: evalPlayer(resultBoard, player),
        });
      }
    }

    // Sort by player's own evaluation (descending) — matches how the AI picks moves
    candidatesWithScore.sort((a, b) => b.playerScore - a.playerScore);

    // Strip playerScore for storage, keeping the sort order
    const candidates: CandidateMove[] = candidatesWithScore.map(({ playerScore: _, ...rest }) => rest);

    // Deduplicate by sorted notation (different orderings of the same moves are identical)
    // Preserve isPlayed flag across duplicates
    const seenMap = new Map<string, number>(); // key -> index in uniqueCandidates
    const uniqueCandidates: CandidateMove[] = [];
    for (const c of candidates) {
      const key = c.moves.map((m) => `${m.from}/${m.to}`).sort().join(" ");
      const existing = seenMap.get(key);
      if (existing === undefined) {
        seenMap.set(key, uniqueCandidates.length);
        uniqueCandidates.push(c);
      } else if (c.isPlayed) {
        // A duplicate is the played move — mark the kept candidate as played
        uniqueCandidates[existing] = { ...uniqueCandidates[existing], isPlayed: true };
      }
    }

    // Top 5 candidates, but always include the played move
    let topCandidates = uniqueCandidates.slice(0, 5);
    const hasPlayed = topCandidates.some((c) => c.isPlayed);
    if (!hasPlayed) {
      const playedCandidate = uniqueCandidates.find((c) => c.isPlayed);
      if (playedCandidate) {
        topCandidates = [...topCandidates.slice(0, 4), playedCandidate];
      }
    }

    // Apply the played moves to get actual resulting board
    const playedBoard = applyMoveSequence(board, player, playedMoves);
    const playedEquity = evalWhite(playedBoard);

    // Best equity (white perspective) from the correctly-ranked candidates
    const bestEquity = uniqueCandidates.length > 0 ? uniqueCandidates[0].equity : playedEquity;

    // Equity loss: use player-perspective eval for accurate comparison
    // (candidates are already sorted by player eval, so [0] is truly best from player's view)
    const bestPlayerScore = uniqueCandidates.length > 0
      ? evalPlayer(applyMoveSequence(board, player, uniqueCandidates[0].moves), player)
      : evalPlayer(playedBoard, player);
    const playedPlayerScore = evalPlayer(playedBoard, player);
    const equityLoss = Math.max(0, normalize(bestPlayerScore) - normalize(playedPlayerScore));

    const errorClass = classifyError(equityLoss);

    turns.push({
      turnNumber: i + 1,
      player,
      dice,
      playedMoves,
      playedNotation: formatNotation(playedMoves),
      equityAfter: playedEquity,
      bestEquity,
      equityLoss,
      errorClass,
      candidates: topCandidates,
      boardBefore: board,
    });

    equityHistory.push(playedEquity);

    // Advance board state
    board = playedBoard;
  }

  // Compute per-player summaries
  const whiteSummary = computeSummary(turns, "white");
  const blackSummary = computeSummary(turns, "black");

  return { turns, equityHistory, whiteSummary, blackSummary };
}

function computeSummary(turns: TurnAnalysis[], player: Player): PlayerSummary {
  const playerTurns = turns.filter((t) => t.player === player);
  const totalTurns = playerTurns.length;

  if (totalTurns === 0) {
    return {
      totalTurns: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      avgEquityLoss: 0,
      performanceRating: 100,
    };
  }

  const blunders = playerTurns.filter((t) => t.errorClass === "blunder").length;
  const mistakes = playerTurns.filter((t) => t.errorClass === "mistake").length;
  const inaccuracies = playerTurns.filter(
    (t) => t.errorClass === "inaccuracy"
  ).length;
  const totalEquityLoss = playerTurns.reduce(
    (sum, t) => sum + t.equityLoss,
    0
  );
  const avgEquityLoss = totalEquityLoss / totalTurns;
  const performanceRating = computePerformanceRating(avgEquityLoss);

  return {
    totalTurns,
    blunders,
    mistakes,
    inaccuracies,
    avgEquityLoss,
    performanceRating,
  };
}

/* ── WASM-Based Analysis ── */

/**
 * Analyze a game using GNU Backgammon's WASM engine for proper equity scores.
 * Returns the same GameAnalysis structure but with accurate neural-network equity
 * and win probability data.
 *
 * Processes turns sequentially (each WASM call takes ~50-200ms).
 * Falls back to heuristic analysis for any turn where WASM fails.
 */
export async function analyzeGameWithGnubg(
  turnHistory: TurnRecord[],
  onProgress?: (current: number, total: number) => void,
): Promise<GameAnalysis> {
  if (!isGnubgReady()) {
    return analyzeGame(turnHistory);
  }

  let board = createInitialBoard();
  const equityHistory: number[] = [0]; // gnubg equity starts at 0 (equal position)
  const turns: TurnAnalysis[] = [];

  for (let i = 0; i < turnHistory.length; i++) {
    onProgress?.(i + 1, turnHistory.length);

    const turn = turnHistory[i];
    const { player, dice, moves: playedMoves } = turn;

    // Use stored board state if available
    if (turn.boardBefore) {
      board = turn.boardBefore;
    }

    let turnAnalysis: TurnAnalysis;

    try {
      // Get all scored candidates from gnubg
      const gnubgResults = await getGnubgMoves(board, player, dice, {
        scoreMoves: true,
        maxMoves: 0, // 0 = return all moves
      });

      turnAnalysis = buildGnubgTurnAnalysis(
        i + 1,
        player,
        dice,
        playedMoves,
        board,
        gnubgResults,
      );
    } catch {
      // Fall back to heuristic analysis for this turn
      turnAnalysis = buildHeuristicTurnAnalysis(
        i + 1,
        player,
        dice,
        playedMoves,
        board,
      );
    }

    turns.push(turnAnalysis);
    equityHistory.push(turnAnalysis.equityAfter);

    // Advance board state
    board = applyMoveSequence(board, player, playedMoves);
  }

  const whiteSummary = computeSummary(turns, "white");
  const blackSummary = computeSummary(turns, "black");

  return { turns, equityHistory, whiteSummary, blackSummary };
}

/** Build a TurnAnalysis from gnubg scored results */
function buildGnubgTurnAnalysis(
  turnNumber: number,
  player: Player,
  dice: [number, number],
  playedMoves: Move[],
  board: BoardState,
  gnubgResults: GnubgMoveResult[],
): TurnAnalysis {
  const playedKey = playedMoves.map((m) => `${m.from}/${m.to}`).sort().join(" ");

  // Build candidates from gnubg results
  // gnubg returns them sorted best-first by equity
  const candidates: CandidateMove[] = [];
  let playedEquity: number | null = null;
  let bestEquity: number | null = null;
  let playedProbability: WinProbability | undefined;

  for (const result of gnubgResults) {
    const key = result.moves.map((m) => `${m.from}/${m.to}`).sort().join(" ");
    const isPlayed = key === playedKey;

    // gnubg equity is from current player's perspective
    // Convert to white's perspective for consistent display
    const rawEq = result.evaluation?.eq ?? 0;
    const whiteEq = player === "white" ? rawEq : -rawEq;

    if (bestEquity === null) {
      bestEquity = whiteEq; // first result is the best
    }

    if (isPlayed) {
      playedEquity = whiteEq;
      playedProbability = result.evaluation?.probability;
    }

    candidates.push({
      moves: result.moves,
      notation: formatNotation(result.moves),
      equity: whiteEq,
      isPlayed,
      probability: result.evaluation?.probability,
    });
  }

  // If no move matched played (edge case: gnubg may have different move generation),
  // fall back to computing played equity from heuristic
  if (playedEquity === null) {
    const playedBoard = applyMoveSequence(board, player, playedMoves);
    playedEquity = evalWhite(playedBoard);

    // Add the played move to candidates
    candidates.push({
      moves: playedMoves,
      notation: formatNotation(playedMoves),
      equity: playedEquity,
      isPlayed: true,
    });
  }

  if (bestEquity === null) {
    bestEquity = playedEquity;
  }

  // Equity loss: from the moving player's perspective
  const bestPlayerEq = candidates.length > 0 ? (candidates[0].equity) : playedEquity;
  const equityLoss = player === "white"
    ? Math.max(0, bestPlayerEq - playedEquity)
    : Math.max(0, playedEquity - bestPlayerEq); // for black, lower white equity is better

  // Top 5 candidates + always include played
  let topCandidates = candidates.slice(0, 5);
  if (!topCandidates.some((c) => c.isPlayed)) {
    const played = candidates.find((c) => c.isPlayed);
    if (played) {
      topCandidates = [...topCandidates.slice(0, 4), played];
    }
  }

  return {
    turnNumber,
    player,
    dice,
    playedMoves,
    playedNotation: formatNotation(playedMoves),
    equityAfter: playedEquity,
    bestEquity,
    equityLoss,
    errorClass: classifyError(equityLoss),
    candidates: topCandidates,
    boardBefore: board,
    probability: playedProbability,
  };
}

/** Fallback: build TurnAnalysis using heuristic evaluation (same as analyzeGame logic) */
function buildHeuristicTurnAnalysis(
  turnNumber: number,
  player: Player,
  dice: [number, number],
  playedMoves: Move[],
  board: BoardState,
): TurnAnalysis {
  const diceArray = buildDiceArray(dice);
  const allSequences = generateAllMoveSequences(board, player, diceArray);
  const playedKey = playedMoves.map((m) => `${m.from}/${m.to}`).sort().join(" ");

  const candidatesWithScore: (CandidateMove & { playerScore: number })[] = [];

  if (allSequences.length === 0 || (allSequences.length === 1 && allSequences[0].length === 0)) {
    candidatesWithScore.push({
      moves: [],
      notation: "(no moves)",
      equity: evalWhite(board),
      isPlayed: playedMoves.length === 0,
      playerScore: evalPlayer(board, player),
    });
  } else {
    for (const seq of allSequences) {
      const resultBoard = applyMoveSequence(board, player, seq);
      const key = seq.map((m) => `${m.from}/${m.to}`).sort().join(" ");
      candidatesWithScore.push({
        moves: seq,
        notation: formatNotation(seq),
        equity: evalWhite(resultBoard),
        isPlayed: key === playedKey,
        playerScore: evalPlayer(resultBoard, player),
      });
    }
  }

  candidatesWithScore.sort((a, b) => b.playerScore - a.playerScore);
  const candidates: CandidateMove[] = candidatesWithScore.map(({ playerScore: _, ...rest }) => rest);

  // Deduplicate
  const seenMap = new Map<string, number>();
  const uniqueCandidates: CandidateMove[] = [];
  for (const c of candidates) {
    const key = c.moves.map((m) => `${m.from}/${m.to}`).sort().join(" ");
    const existing = seenMap.get(key);
    if (existing === undefined) {
      seenMap.set(key, uniqueCandidates.length);
      uniqueCandidates.push(c);
    } else if (c.isPlayed) {
      uniqueCandidates[existing] = { ...uniqueCandidates[existing], isPlayed: true };
    }
  }

  let topCandidates = uniqueCandidates.slice(0, 5);
  if (!topCandidates.some((c) => c.isPlayed)) {
    const playedCandidate = uniqueCandidates.find((c) => c.isPlayed);
    if (playedCandidate) {
      topCandidates = [...topCandidates.slice(0, 4), playedCandidate];
    }
  }

  const playedBoard = applyMoveSequence(board, player, playedMoves);
  const playedEquity = evalWhite(playedBoard);
  const bestEquity = uniqueCandidates.length > 0 ? uniqueCandidates[0].equity : playedEquity;
  const bestPlayerScore = uniqueCandidates.length > 0
    ? evalPlayer(applyMoveSequence(board, player, uniqueCandidates[0].moves), player)
    : evalPlayer(playedBoard, player);
  const playedPlayerScore = evalPlayer(playedBoard, player);
  const equityLoss = Math.max(0, normalize(bestPlayerScore) - normalize(playedPlayerScore));

  return {
    turnNumber,
    player,
    dice,
    playedMoves,
    playedNotation: formatNotation(playedMoves),
    equityAfter: playedEquity,
    bestEquity,
    equityLoss,
    errorClass: classifyError(equityLoss),
    candidates: topCandidates,
    boardBefore: board,
  };
}
