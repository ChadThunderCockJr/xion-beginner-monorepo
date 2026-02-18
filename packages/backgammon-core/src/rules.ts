import {
  BoardState,
  GameState,
  Player,
  ResultType,
  TOTAL_CHECKERS,
} from "./types";
import { createInitialBoard } from "./board";
import { applySingleMove, generateAllMoveSequences } from "./moves";

/** Create a new game state */
export function createGameState(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: "white", // White always goes first (after initial roll)
    dice: null,
    movesRemaining: [],
    gameOver: false,
    winner: null,
    resultType: null,
    turnNumber: 0,
    moveHistory: [],
  };
}

/** Set dice for the current turn */
export function setDice(
  state: GameState,
  die1: number,
  die2: number
): GameState {
  const dice: [number, number] = [die1, die2];
  const movesRemaining =
    die1 === die2
      ? [die1, die1, die1, die1] // Doubles: 4 moves
      : [die1, die2];

  return {
    ...state,
    dice,
    movesRemaining,
    turnNumber: state.turnNumber + 1,
  };
}

/**
 * Validate and apply a move. Returns the new game state or null if invalid.
 */
export function makeMove(
  state: GameState,
  from: number,
  to: number
): GameState | null {
  if (state.gameOver) return null;
  if (state.movesRemaining.length === 0) return null;

  // Find which die value this move uses
  const player = state.currentPlayer;
  const allSequences = generateAllMoveSequences(
    state.board,
    player,
    state.movesRemaining
  );

  // Check if this move appears as a valid first move in any maximum-length sequence
  let matchedDie: number | null = null;
  for (const seq of allSequences) {
    if (seq.length > 0 && seq[0].from === from && seq[0].to === to) {
      matchedDie = seq[0].die;
      break;
    }
  }

  if (matchedDie === null) return null; // Illegal move

  // Apply the move
  const newBoard = applySingleMove(state.board, player, from, to);
  const newRemaining = [...state.movesRemaining];
  const dieIdx = newRemaining.indexOf(matchedDie);
  newRemaining.splice(dieIdx, 1);

  // Check if game is over
  const gameOverResult = checkGameOver(newBoard);

  // Check if the turn should end (no remaining moves or no legal moves)
  let shouldEndTurn = newRemaining.length === 0;
  if (!shouldEndTurn && newRemaining.length > 0) {
    const nextSequences = generateAllMoveSequences(
      newBoard,
      player,
      newRemaining
    );
    const maxMoves = Math.max(0, ...nextSequences.map((s) => s.length));
    if (maxMoves === 0) shouldEndTurn = true;
  }

  const newState: GameState = {
    ...state,
    board: newBoard,
    dice: shouldEndTurn ? null : state.dice,
    movesRemaining: shouldEndTurn ? [] : newRemaining,
    currentPlayer:
      shouldEndTurn && !gameOverResult.over
        ? player === "white"
          ? "black"
          : "white"
        : player,
    gameOver: gameOverResult.over,
    winner: gameOverResult.winner,
    resultType: gameOverResult.resultType,
  };

  return newState;
}

/** End the current turn (when all dice are used or no more legal moves) */
export function endTurn(state: GameState): GameState {
  if (state.gameOver) return state;

  return {
    ...state,
    dice: null,
    movesRemaining: [],
    currentPlayer: state.currentPlayer === "white" ? "black" : "white",
  };
}

/** Check if any legal moves exist for the current dice */
export function hasLegalMoves(state: GameState): boolean {
  if (state.movesRemaining.length === 0) return false;
  const sequences = generateAllMoveSequences(
    state.board,
    state.currentPlayer,
    state.movesRemaining
  );
  return sequences.some((s) => s.length > 0);
}

/** Check game-over conditions */
export function checkGameOver(board: BoardState): {
  over: boolean;
  winner: Player | null;
  resultType: ResultType | null;
} {
  if (board.whiteOff === TOTAL_CHECKERS) {
    // White wins -- check for gammon/backgammon
    if (board.blackOff === 0) {
      // Black hasn't borne off any -- gammon at minimum
      // Check for backgammon: black has checkers in white's home board (1-6) or on bar
      let blackInWhiteHome = false;
      for (let i = 1; i <= 6; i++) {
        if (board.points[i] < 0) {
          blackInWhiteHome = true;
          break;
        }
      }
      if (board.points[25] < 0) blackInWhiteHome = true; // black bar

      return {
        over: true,
        winner: "white",
        resultType: blackInWhiteHome ? "backgammon" : "gammon",
      };
    }
    return { over: true, winner: "white", resultType: "normal" };
  }

  if (board.blackOff === TOTAL_CHECKERS) {
    if (board.whiteOff === 0) {
      let whiteInBlackHome = false;
      for (let i = 19; i <= 24; i++) {
        if (board.points[i] > 0) {
          whiteInBlackHome = true;
          break;
        }
      }
      if (board.points[0] > 0) whiteInBlackHome = true; // white bar

      return {
        over: true,
        winner: "black",
        resultType: whiteInBlackHome ? "backgammon" : "gammon",
      };
    }
    return { over: true, winner: "black", resultType: "normal" };
  }

  return { over: false, winner: null, resultType: null };
}
