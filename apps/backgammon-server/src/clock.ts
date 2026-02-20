import type { Player } from "@xion-beginner/backgammon-core";

export interface GameClock {
  whiteTimeMs: number;
  blackTimeMs: number;
  incrementMs: number;       // Bronstein: added per move, up to time spent
  turnStartedAt: number;     // timestamp when current turn started
  activePlayer: Player;
  paused: boolean;
}

/** Create a new clock with given time limit and increment */
export function createClock(
  timeLimitMs: number = 3 * 60 * 1000,  // 3 minutes default
  incrementMs: number = 10 * 1000,       // 10 seconds Bronstein increment
): GameClock {
  return {
    whiteTimeMs: timeLimitMs,
    blackTimeMs: timeLimitMs,
    incrementMs,
    turnStartedAt: Date.now(),
    activePlayer: "white",
    paused: true,
  };
}

/** Start or resume the clock for a player's turn */
export function startTurn(clock: GameClock, player: Player): GameClock {
  return {
    ...clock,
    activePlayer: player,
    turnStartedAt: Date.now(),
    paused: false,
  };
}

/** End the current turn — deducts time spent, applies Bronstein increment */
export function endTurn(clock: GameClock): GameClock {
  if (clock.paused) return clock;

  const now = Date.now();
  const timeSpent = now - clock.turnStartedAt;

  // Bronstein increment: add back up to incrementMs, but never more than time spent
  const increment = Math.min(clock.incrementMs, timeSpent);

  const newClock = { ...clock, paused: true };

  if (clock.activePlayer === "white") {
    newClock.whiteTimeMs = Math.max(0, clock.whiteTimeMs - timeSpent + increment);
  } else {
    newClock.blackTimeMs = Math.max(0, clock.blackTimeMs - timeSpent + increment);
  }

  return newClock;
}

/** Get remaining time for a player (accounting for elapsed time if their turn) */
export function getRemainingTime(clock: GameClock, player: Player): number {
  const baseTime = player === "white" ? clock.whiteTimeMs : clock.blackTimeMs;

  if (clock.paused || clock.activePlayer !== player) {
    return baseTime;
  }

  // Active turn — subtract elapsed time
  const elapsed = Date.now() - clock.turnStartedAt;
  return Math.max(0, baseTime - elapsed);
}

/** Check if a player's time has expired */
export function isTimeExpired(clock: GameClock, player: Player): boolean {
  return getRemainingTime(clock, player) <= 0;
}

/** Get clock state for broadcasting to clients */
export function getClockState(clock: GameClock): {
  whiteTimeMs: number;
  blackTimeMs: number;
  activePlayer: Player;
  incrementMs: number;
} {
  return {
    whiteTimeMs: getRemainingTime(clock, "white"),
    blackTimeMs: getRemainingTime(clock, "black"),
    activePlayer: clock.activePlayer,
    incrementMs: clock.incrementMs,
  };
}

/** Pause the clock (e.g., during disconnection grace period) */
export function pauseClock(clock: GameClock): GameClock {
  if (clock.paused) return clock;

  const now = Date.now();
  const elapsed = now - clock.turnStartedAt;

  const newClock = { ...clock, paused: true };

  if (clock.activePlayer === "white") {
    newClock.whiteTimeMs = Math.max(0, clock.whiteTimeMs - elapsed);
  } else {
    newClock.blackTimeMs = Math.max(0, clock.blackTimeMs - elapsed);
  }

  return newClock;
}

/** Resume the clock after a pause */
export function resumeClock(clock: GameClock): GameClock {
  return {
    ...clock,
    turnStartedAt: Date.now(),
    paused: false,
  };
}
