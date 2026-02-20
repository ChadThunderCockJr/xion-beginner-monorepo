import { describe, it, expect } from "vitest";
import {
  createGameState,
  setDice,
  getLegalFirstMoves,
  makeMove,
  createInitialBoard,
  canBearOff,
  checkGameOver,
  type BoardState,
  type GameState,
} from "../index";

/** Helper to create a game state with a custom board */
function createStateWithBoard(board: BoardState, currentPlayer: "white" | "black" = "white"): GameState {
  return {
    board,
    currentPlayer,
    dice: null,
    movesRemaining: [],
    gameOver: false,
    winner: null,
    resultType: null,
    turnNumber: 0,
    moveHistory: [],
    cubeValue: 1,
    cubeOwner: null,
  };
}

/** Helper to create an empty board */
function emptyBoard(): BoardState {
  return { points: new Array(26).fill(0), whiteOff: 0, blackOff: 0 };
}

describe("Opening Position Tests", () => {
  it("should have correct initial position", () => {
    const board = createInitialBoard();
    // White checkers: 2 on 24, 5 on 13, 3 on 8, 5 on 6
    expect(board.points[24]).toBe(2);
    expect(board.points[13]).toBe(5);
    expect(board.points[8]).toBe(3);
    expect(board.points[6]).toBe(5);
    // Black checkers: -2 on 1, -5 on 12, -3 on 17, -5 on 19
    expect(board.points[1]).toBe(-2);
    expect(board.points[12]).toBe(-5);
    expect(board.points[17]).toBe(-3);
    expect(board.points[19]).toBe(-5);
  });

  it("should have legal moves for all 21 distinct opening rolls", () => {
    const state = createGameState();
    const rolls: [number, number][] = [];
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = d1; d2 <= 6; d2++) {
        rolls.push([d1, d2]);
      }
    }
    expect(rolls.length).toBe(21);

    for (const [d1, d2] of rolls) {
      const withDice = setDice(state, d1, d2);
      const moves = getLegalFirstMoves(
        withDice.board,
        withDice.currentPlayer,
        withDice.movesRemaining,
      );
      expect(moves.length).toBeGreaterThan(0);
    }
  });
});

describe("Bearing Off Edge Cases", () => {
  it("should allow bearing off with exact roll", () => {
    const board = emptyBoard();
    board.points[1] = 1; // white checker on point 1
    board.whiteOff = 14;
    board.blackOff = 15;

    const state = createStateWithBoard(board);
    const withDice = setDice(state, 1, 2);
    const moves = getLegalFirstMoves(withDice.board, "white", withDice.movesRemaining);

    // Should be able to bear off from point 1 with die 1
    const bearOffMoves = moves.filter((m) => m.from === 1);
    expect(bearOffMoves.length).toBeGreaterThan(0);
  });

  it("should allow overshoot bearing off when no exact match", () => {
    const board = emptyBoard();
    board.points[2] = 1; // white checker on point 2 (only checker)
    board.whiteOff = 14;
    board.blackOff = 15;

    const state = createStateWithBoard(board);
    const withDice = setDice(state, 5, 6);
    const moves = getLegalFirstMoves(withDice.board, "white", withDice.movesRemaining);

    // Should be able to bear off from point 2 with die 5 or 6 (overshoot)
    const bearOffMoves = moves.filter((m) => m.from === 2);
    expect(bearOffMoves.length).toBeGreaterThan(0);
  });

  it("should not allow bearing off with checkers outside home board", () => {
    const board = emptyBoard();
    board.points[1] = 2;  // white on point 1 (home)
    board.points[10] = 1; // white on point 10 (NOT home)
    board.whiteOff = 12;
    board.blackOff = 15;

    expect(canBearOff(board, "white")).toBe(false);
  });

  it("should not allow bearing off with checker on bar", () => {
    const board = emptyBoard();
    board.points[0] = 1; // white on bar
    board.points[1] = 2;
    board.whiteOff = 12;
    board.blackOff = 15;

    expect(canBearOff(board, "white")).toBe(false);
  });
});

describe("Bar Entry Tests", () => {
  it("should force bar entry before other moves", () => {
    const board = emptyBoard();
    board.points[0] = 1; // white on bar
    board.points[6] = 5; // white on point 6
    board.blackOff = 15;

    const state = createStateWithBoard(board);
    const withDice = setDice(state, 3, 4);
    const moves = getLegalFirstMoves(withDice.board, "white", withDice.movesRemaining);

    // All moves should be from bar (point 0)
    for (const move of moves) {
      expect(move.from).toBe(0);
    }
  });

  it("should not allow bar entry to blocked points", () => {
    const board = emptyBoard();
    board.points[0] = 1;   // white on bar
    board.points[22] = -2; // black blocks point 22
    board.points[23] = -2; // black blocks point 23
    board.points[24] = -2; // black blocks point 24
    board.blackOff = 9;

    const state = createStateWithBoard(board);
    const withDice = setDice(state, 1, 2); // would enter on 24 or 23 — both blocked
    const moves = getLegalFirstMoves(withDice.board, "white", withDice.movesRemaining);

    // Point 24 (die 1) and point 23 (die 2) are both blocked
    const barEntries = moves.filter((m) => m.from === 0);
    // Neither 24 nor 23 should be available
    const to24 = barEntries.filter((m) => m.to === 24);
    const to23 = barEntries.filter((m) => m.to === 23);
    expect(to24.length).toBe(0);
    expect(to23.length).toBe(0);
  });
});

describe("Game Over Detection", () => {
  it("should detect normal win", () => {
    const board = emptyBoard();
    board.whiteOff = 15;
    board.blackOff = 3; // black bore off some

    const result = checkGameOver(board);
    expect(result.over).toBe(true);
    expect(result.winner).toBe("white");
    expect(result.resultType).toBe("normal");
  });

  it("should detect gammon", () => {
    const board = emptyBoard();
    board.whiteOff = 15;
    board.blackOff = 0;
    board.points[19] = -15; // all black still on board, but not in white's home

    const result = checkGameOver(board);
    expect(result.over).toBe(true);
    expect(result.winner).toBe("white");
    expect(result.resultType).toBe("gammon");
  });

  it("should detect backgammon", () => {
    const board = emptyBoard();
    board.whiteOff = 15;
    board.blackOff = 0;
    board.points[1] = -1; // black checker in white's home board

    const result = checkGameOver(board);
    expect(result.over).toBe(true);
    expect(result.winner).toBe("white");
    expect(result.resultType).toBe("backgammon");
  });

  it("should detect backgammon with checker on bar", () => {
    const board = emptyBoard();
    board.whiteOff = 15;
    board.blackOff = 0;
    board.points[25] = -1; // black on bar
    board.points[19] = -14;

    const result = checkGameOver(board);
    expect(result.over).toBe(true);
    expect(result.winner).toBe("white");
    expect(result.resultType).toBe("backgammon");
  });
});
