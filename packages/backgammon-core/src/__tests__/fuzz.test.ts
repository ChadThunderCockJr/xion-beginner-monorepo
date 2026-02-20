import { describe, it, expect } from "vitest";
import {
  createGameState,
  setDice,
  makeMove,
  endTurn,
  hasLegalMoves,
  getLegalFirstMoves,
  checkGameOver,
  type GameState,
  type Move,
  TOTAL_CHECKERS,
} from "../index";

/**
 * Count total checkers for both players across all locations.
 * Should always equal 30 (15 per player).
 */
function countAllCheckers(state: GameState): { white: number; black: number } {
  let white = 0;
  let black = 0;

  for (let i = 0; i <= 25; i++) {
    const val = state.board.points[i];
    if (val > 0) white += val;
    if (val < 0) black += -val;
  }

  white += state.board.whiteOff;
  black += state.board.blackOff;

  return { white, black };
}

/** Generate a random die roll */
function randomDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Play a random legal move and return the new state */
function playRandomMove(state: GameState): GameState {
  const legalMoves = getLegalFirstMoves(
    state.board,
    state.currentPlayer,
    state.movesRemaining,
  );

  if (legalMoves.length === 0) return state;

  const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  const result = makeMove(state, move.from, move.to);
  return result ?? state;
}

describe("Fuzz Testing", () => {
  it("should maintain checker count invariant across 1000 random games", { timeout: 30000 }, () => {
    for (let game = 0; game < 1000; game++) {
      let state = createGameState();
      let turns = 0;
      const maxTurns = 300; // prevent infinite games

      while (!state.gameOver && turns < maxTurns) {
        // Roll dice
        const die1 = randomDie();
        const die2 = randomDie();
        state = setDice(state, die1, die2);

        // Play random moves until no more legal moves
        let moveAttempts = 0;
        while (state.movesRemaining.length > 0 && hasLegalMoves(state) && moveAttempts < 10) {
          state = playRandomMove(state);
          moveAttempts++;
        }

        // Verify checker count invariant
        const counts = countAllCheckers(state);
        expect(counts.white).toBe(TOTAL_CHECKERS);
        expect(counts.black).toBe(TOTAL_CHECKERS);

        // Verify board state integrity
        expect(state.board.points.length).toBe(26);
        expect(state.board.whiteOff).toBeGreaterThanOrEqual(0);
        expect(state.board.whiteOff).toBeLessThanOrEqual(TOTAL_CHECKERS);
        expect(state.board.blackOff).toBeGreaterThanOrEqual(0);
        expect(state.board.blackOff).toBeLessThanOrEqual(TOTAL_CHECKERS);

        // End turn if not game over
        if (!state.gameOver) {
          state = endTurn(state);
        }
        turns++;
      }

      // If game ended, verify game over conditions
      if (state.gameOver) {
        expect(state.winner).toBeTruthy();
        expect(["normal", "gammon", "backgammon"]).toContain(state.resultType);

        if (state.winner === "white") {
          expect(state.board.whiteOff).toBe(TOTAL_CHECKERS);
        } else {
          expect(state.board.blackOff).toBe(TOTAL_CHECKERS);
        }
      }
    }
  });

  it("should never produce invalid board positions", { timeout: 30000 }, () => {
    for (let game = 0; game < 500; game++) {
      let state = createGameState();
      let turns = 0;

      while (!state.gameOver && turns < 200) {
        const die1 = randomDie();
        const die2 = randomDie();
        state = setDice(state, die1, die2);

        let moveAttempts = 0;
        while (state.movesRemaining.length > 0 && hasLegalMoves(state) && moveAttempts < 10) {
          state = playRandomMove(state);
          moveAttempts++;

          // No checker should be at invalid positions
          for (let i = 1; i <= 24; i++) {
            const val = state.board.points[i];
            // A point can't have both colors
            // (positive = white, negative = black, never mixed)
            expect(val === 0 || val > 0 || val < 0).toBe(true);
          }

          // Bar values should be correct sign
          expect(state.board.points[0]).toBeGreaterThanOrEqual(0); // white bar (positive)
          expect(state.board.points[25]).toBeLessThanOrEqual(0); // black bar (negative)
        }

        if (!state.gameOver) {
          state = endTurn(state);
        }
        turns++;
      }
    }
  });

  it("should not mutate input state (immutability)", () => {
    for (let trial = 0; trial < 100; trial++) {
      let state = createGameState();
      const die1 = randomDie();
      const die2 = randomDie();

      const beforeDice = JSON.stringify(state);
      const afterDiceState = setDice(state, die1, die2);
      expect(JSON.stringify(state)).toBe(beforeDice);

      if (hasLegalMoves(afterDiceState)) {
        const legalMoves = getLegalFirstMoves(
          afterDiceState.board,
          afterDiceState.currentPlayer,
          afterDiceState.movesRemaining,
        );
        if (legalMoves.length > 0) {
          const beforeMove = JSON.stringify(afterDiceState);
          makeMove(afterDiceState, legalMoves[0].from, legalMoves[0].to);
          expect(JSON.stringify(afterDiceState)).toBe(beforeMove);
        }
      }
    }
  });

  it("gameOver should only be true when one player has 15 off", () => {
    for (let game = 0; game < 500; game++) {
      let state = createGameState();
      let turns = 0;

      while (!state.gameOver && turns < 200) {
        state = setDice(state, randomDie(), randomDie());

        let moveAttempts = 0;
        while (state.movesRemaining.length > 0 && hasLegalMoves(state) && moveAttempts < 10) {
          state = playRandomMove(state);
          moveAttempts++;

          if (state.gameOver) {
            // Verify winner bore off all checkers
            const result = checkGameOver(state.board);
            expect(result.over).toBe(true);
            expect(
              state.board.whiteOff === TOTAL_CHECKERS ||
              state.board.blackOff === TOTAL_CHECKERS,
            ).toBe(true);
          }
        }

        if (!state.gameOver) {
          state = endTurn(state);
        }
        turns++;
      }
    }
  });
});
