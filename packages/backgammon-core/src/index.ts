// Types
export type {
  BoardState,
  GameState,
  Move,
  MoveRecord,
  Player,
  ResultType,
} from "./types";
export {
  WHITE_BAR,
  BLACK_BAR,
  BEAR_OFF_WHITE,
  BEAR_OFF_BLACK,
  TOTAL_CHECKERS,
  NUM_POINTS,
} from "./types";

// Board utilities
export {
  createInitialBoard,
  cloneBoard,
  getCheckerCount,
  isPointBlocked,
  isBlot,
  getBarIndex,
  getBarCount,
  canBearOff,
  countCheckersOnBoard,
  getPipCount,
} from "./board";

// Move generation
export {
  applySingleMove,
  generateAllMoveSequences,
  getLegalFirstMoves,
  getLegalNextMoves,
} from "./moves";

// Game rules
export {
  createGameState,
  setDice,
  makeMove,
  endTurn,
  hasLegalMoves,
  checkGameOver,
  canDouble,
  offerDouble,
  acceptDouble,
  rejectDouble,
  setOpeningRoll,
} from "./rules";

// Notation
export { formatMove, formatTurn, formatGame } from "./notation";

// Match scoring
export type { MatchState } from "./types";
export {
  createMatch,
  scoreGame,
  isMatchOver,
  isCrawfordGame,
  pointsToWin,
} from "./match";
