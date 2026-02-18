export type Player = "white" | "black";

export interface BoardState {
  // 26 elements: index 0 = white bar, 1-24 = points, 25 = black bar
  // Positive = white checkers, Negative = black checkers
  points: number[];
  whiteOff: number; // white checkers borne off (0-15)
  blackOff: number; // black checkers borne off (0-15)
}

export interface Move {
  from: number; // 0=white bar, 1-24=point, 25=black bar
  to: number; // 1-24=point, 0=bear-off(white), 25=bear-off(black)
  die: number; // which die value this uses (1-6)
}

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  dice: [number, number] | null;
  movesRemaining: number[]; // dice values not yet used this turn
  gameOver: boolean;
  winner: Player | null;
  resultType: ResultType | null;
  turnNumber: number;
  moveHistory: MoveRecord[];
}

export type ResultType = "normal" | "gammon" | "backgammon";

export interface MoveRecord {
  turnNumber: number;
  player: Player;
  dice: [number, number];
  moves: Move[];
}

// Constants
export const WHITE_BAR = 0;
export const BLACK_BAR = 25;
export const BEAR_OFF_WHITE = 25; // white bears off "past" point 24
export const BEAR_OFF_BLACK = 0; // black bears off "past" point 1
export const TOTAL_CHECKERS = 15;
export const NUM_POINTS = 24;
