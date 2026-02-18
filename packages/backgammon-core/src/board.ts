import { BoardState, Player, WHITE_BAR, BLACK_BAR } from "./types";

export function createInitialBoard(): BoardState {
  const points = new Array(26).fill(0);
  // Standard backgammon starting position
  // White moves from 24 toward 1 (home board is 1-6)
  // Black moves from 1 toward 24 (home board is 19-24)
  //
  // In our array (positive=white, negative=black):
  points[24] = 2; // White: 2 checkers
  points[13] = 5; // White: 5 checkers
  points[8] = 3; // White: 3 checkers
  points[6] = 5; // White: 5 checkers
  points[1] = -2; // Black: 2 checkers
  points[12] = -5; // Black: 5 checkers
  points[17] = -3; // Black: 3 checkers
  points[19] = -5; // Black: 5 checkers

  return { points, whiteOff: 0, blackOff: 0 };
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    points: [...board.points],
    whiteOff: board.whiteOff,
    blackOff: board.blackOff,
  };
}

/** Get the count of checkers for a player on a specific point */
export function getCheckerCount(
  board: BoardState,
  point: number,
  player: Player
): number {
  const val = board.points[point];
  if (player === "white") return val > 0 ? val : 0;
  return val < 0 ? -val : 0;
}

/** Check if a point is owned by a player (has 2+ checkers) -- a "made" point */
export function isPointBlocked(
  board: BoardState,
  point: number,
  player: Player
): boolean {
  if (point < 1 || point > 24) return false;
  const val = board.points[point];
  if (player === "white") return val <= -2; // blocked by 2+ black
  return val >= 2; // blocked by 2+ white
}

/** Check if a point has a single opposing checker (blot) */
export function isBlot(
  board: BoardState,
  point: number,
  player: Player
): boolean {
  if (point < 1 || point > 24) return false;
  const val = board.points[point];
  if (player === "white") return val === -1; // single black checker
  return val === 1; // single white checker
}

/** Get the bar index for a player */
export function getBarIndex(player: Player): number {
  return player === "white" ? WHITE_BAR : BLACK_BAR;
}

/** Get count of checkers on the bar */
export function getBarCount(board: BoardState, player: Player): number {
  return getCheckerCount(board, getBarIndex(player), player);
}

/** Check if all of a player's checkers are in their home board (can bear off) */
export function canBearOff(board: BoardState, player: Player): boolean {
  const barCount = getBarCount(board, player);
  if (barCount > 0) return false;

  if (player === "white") {
    // White's home board is points 1-6. No white checkers should be on 7-24.
    for (let i = 7; i <= 24; i++) {
      if (board.points[i] > 0) return false;
    }
  } else {
    // Black's home board is points 19-24. No black checkers should be on 1-18.
    for (let i = 1; i <= 18; i++) {
      if (board.points[i] < 0) return false;
    }
  }
  return true;
}

/** Count total checkers for a player on the board (including bar, excluding borne off) */
export function countCheckersOnBoard(
  board: BoardState,
  player: Player
): number {
  let count = 0;
  for (let i = 0; i <= 25; i++) {
    count += getCheckerCount(board, i, player);
  }
  return count;
}

/** Get the pip count for a player (total distance to bear off) */
export function getPipCount(board: BoardState, player: Player): number {
  let pips = 0;
  if (player === "white") {
    // White moves from high to low, bears off past point 0
    pips +=
      board.points[WHITE_BAR] > 0 ? board.points[WHITE_BAR] * 25 : 0; // bar = 25 pips
    for (let i = 1; i <= 24; i++) {
      if (board.points[i] > 0) {
        pips += board.points[i] * i;
      }
    }
  } else {
    // Black moves from low to high, bears off past point 25
    pips +=
      board.points[BLACK_BAR] < 0 ? -board.points[BLACK_BAR] * 25 : 0;
    for (let i = 1; i <= 24; i++) {
      if (board.points[i] < 0) {
        pips += -board.points[i] * (25 - i);
      }
    }
  }
  return pips;
}
