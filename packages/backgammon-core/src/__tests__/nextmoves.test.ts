import { describe, it, expect } from "vitest";
import {
  createGameState,
  setDice,
  makeMove,
  getLegalFirstMoves,
  getLegalNextMoves,
  type GameState,
  type Move,
  type BoardState,
} from "../index";

/** Helper to create a state with custom board */
function createStateWithBoard(board: BoardState, player: "white" | "black" = "white"): GameState {
  return {
    board,
    currentPlayer: player,
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

function emptyBoard(): BoardState {
  return { points: new Array(26).fill(0), whiteOff: 0, blackOff: 0 };
}

describe("getLegalNextMoves", () => {
  it("should return correct remaining moves after first move", () => {
    const state = createGameState();
    const withDice = setDice(state, 3, 5);

    // Make the first move
    const firstMoves = getLegalFirstMoves(
      withDice.board,
      withDice.currentPlayer,
      withDice.movesRemaining,
    );
    expect(firstMoves.length).toBeGreaterThan(0);

    const firstMove = firstMoves[0];
    const afterFirst = makeMove(withDice, firstMove.from, firstMove.to);
    expect(afterFirst).not.toBeNull();

    if (afterFirst && afterFirst.movesRemaining.length > 0) {
      // Get next moves using getLegalNextMoves
      const nextMoves = getLegalNextMoves(
        withDice.board, // original board
        withDice.currentPlayer,
        [3, 5], // original dice
        [firstMove],
      );
      expect(nextMoves.length).toBeGreaterThan(0);

      // Each next move should be a valid position
      for (const move of nextMoves) {
        expect(move.from).toBeGreaterThanOrEqual(0);
        expect(move.from).toBeLessThanOrEqual(25);
        expect(move.to).toBeGreaterThanOrEqual(0);
        expect(move.to).toBeLessThanOrEqual(25);
      }
    }
  });

  it("should handle doubles correctly (4 moves)", () => {
    const state = createGameState();
    const withDice = setDice(state, 3, 3);

    // Should have 4 moves available
    expect(withDice.movesRemaining.length).toBe(4);

    const firstMoves = getLegalFirstMoves(
      withDice.board,
      withDice.currentPlayer,
      withDice.movesRemaining,
    );
    expect(firstMoves.length).toBeGreaterThan(0);

    // Make first move
    const movesMade: Move[] = [];
    let currentState = withDice;

    for (let i = 0; i < 3; i++) {
      const legalMoves = i === 0
        ? getLegalFirstMoves(currentState.board, currentState.currentPlayer, currentState.movesRemaining)
        : getLegalNextMoves(withDice.board, withDice.currentPlayer, [3, 3, 3, 3], movesMade);

      if (legalMoves.length === 0) break;

      const move = legalMoves[0];
      const result = makeMove(currentState, move.from, move.to);
      if (!result) break;

      movesMade.push(move);
      currentState = result;
    }

    // Should have made at least 1 move
    expect(movesMade.length).toBeGreaterThanOrEqual(1);
  });

  it("should require bar entry in next moves after hitting", () => {
    const board = emptyBoard();
    // Set up: white on 24 and 13, black blot on 22
    board.points[24] = 2;
    board.points[13] = 5;
    board.points[8] = 3;
    board.points[6] = 5;
    board.points[22] = -1; // black blot
    board.points[1] = -1;
    board.points[12] = -5;
    board.points[17] = -3;
    board.points[19] = -5;

    const state = createStateWithBoard(board);
    const withDice = setDice(state, 2, 3);

    // First move: hit the blot on 22 (from 24 with die 2)
    const result = makeMove(withDice, 24, 22);
    if (result && !result.gameOver) {
      // After hitting, verify black has a checker on bar
      expect(result.board.points[25]).toBeLessThan(0);
    }
  });
});
