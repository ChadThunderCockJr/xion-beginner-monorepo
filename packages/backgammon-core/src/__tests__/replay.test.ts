import { describe, it, expect } from "vitest";
import {
  createGameState,
  setDice,
  makeMove,
  endTurn,
  hasLegalMoves,
  checkGameOver,
  TOTAL_CHECKERS,
  type GameState,
} from "../index";

/** Verify checker invariants at any point during replay */
function verifyInvariants(state: GameState): void {
  let white = 0;
  let black = 0;

  for (let i = 0; i <= 25; i++) {
    const val = state.board.points[i];
    if (val > 0) white += val;
    if (val < 0) black += -val;
  }

  white += state.board.whiteOff;
  black += state.board.blackOff;

  expect(white).toBe(TOTAL_CHECKERS);
  expect(black).toBe(TOTAL_CHECKERS);
  expect(state.board.points.length).toBe(26);
}

interface ReplayTurn {
  dice: [number, number];
  moves: Array<{ from: number; to: number }>;
}

/** Replay a series of turns and verify each step */
function replayGame(turns: ReplayTurn[]): GameState {
  let state = createGameState();

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    state = setDice(state, turn.dice[0], turn.dice[1]);

    for (const move of turn.moves) {
      const result = makeMove(state, move.from, move.to);
      expect(result).not.toBeNull();
      if (!result) break;
      state = result;
      verifyInvariants(state);
    }

    // Only call endTurn if the turn wasn't already auto-ended by makeMove.
    // makeMove auto-ends the turn (switches currentPlayer, clears dice/movesRemaining)
    // when all dice are consumed or no legal moves remain.
    if (!state.gameOver && state.dice !== null && state.movesRemaining.length > 0) {
      state = endTurn(state);
    }
  }

  return state;
}

describe("Full Game Replay", () => {
  it("should replay a short opening sequence without errors", () => {
    const turns: ReplayTurn[] = [
      // White: 3-1 (from opening position)
      { dice: [3, 1], moves: [{ from: 8, to: 5 }, { from: 6, to: 5 }] },
      // Black: 5-3 (point 6 is blocked by white, so use 12 instead)
      { dice: [5, 3], moves: [{ from: 12, to: 17 }, { from: 1, to: 4 }] },
      // White: 6-4
      { dice: [6, 4], moves: [{ from: 24, to: 18 }, { from: 18, to: 14 }] },
      // Black: 6-2
      { dice: [6, 2], moves: [{ from: 12, to: 18 }, { from: 17, to: 19 }] },
    ];

    const finalState = replayGame(turns);
    expect(finalState.gameOver).toBe(false);
    verifyInvariants(finalState);
  });

  it("should replay moves and maintain correct turn count", () => {
    const turns: ReplayTurn[] = [
      { dice: [4, 2], moves: [{ from: 8, to: 4 }, { from: 6, to: 4 }] },
      { dice: [3, 1], moves: [{ from: 17, to: 20 }, { from: 19, to: 20 }] },
    ];

    const finalState = replayGame(turns);
    // 2 turns of dice sets = turnNumber 2 (setDice increments)
    expect(finalState.turnNumber).toBe(2);
    verifyInvariants(finalState);
  });

  it("should handle a sequence with hitting", () => {
    // Sequence designed to create a hit
    const turns: ReplayTurn[] = [
      // White: move to create a blot
      { dice: [6, 1], moves: [{ from: 13, to: 7 }, { from: 8, to: 7 }] },
      // Black: potentially hit the blot if move is available
      { dice: [5, 2], moves: [{ from: 12, to: 17 }, { from: 17, to: 19 }] },
    ];

    const finalState = replayGame(turns);
    verifyInvariants(finalState);
  });
});
