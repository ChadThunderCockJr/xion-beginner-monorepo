import type { MatchState, Player, ResultType } from "./types";

/** Create a new match state */
export function createMatch(length: number): MatchState {
  return {
    matchLength: length,
    whiteScore: 0,
    blackScore: 0,
    gameNumber: 1,
    isCrawford: false,
    crawfordGamePlayed: false,
  };
}

/** Score a completed game and update match state */
export function scoreGame(
  match: MatchState,
  winner: Player,
  resultType: ResultType,
  cubeValue: number,
): MatchState {
  const multiplier = resultType === "backgammon" ? 3 : resultType === "gammon" ? 2 : 1;
  const points = cubeValue * multiplier;

  const newMatch = { ...match, gameNumber: match.gameNumber + 1 };

  if (winner === "white") {
    newMatch.whiteScore = match.whiteScore + points;
  } else {
    newMatch.blackScore = match.blackScore + points;
  }

  // Crawford rule: when one player is exactly 1 point from winning
  // the NEXT game is a Crawford game (no doubling allowed)
  if (!match.crawfordGamePlayed) {
    const whiteNeeds = match.matchLength - newMatch.whiteScore;
    const blackNeeds = match.matchLength - newMatch.blackScore;

    if (whiteNeeds === 1 || blackNeeds === 1) {
      // This player just reached match point - 1
      // The next game is the Crawford game
      newMatch.isCrawford = true;
    }
  }

  // If this WAS the Crawford game, mark it as played
  if (match.isCrawford) {
    newMatch.isCrawford = false;
    newMatch.crawfordGamePlayed = true;
  }

  return newMatch;
}

/** Check if the match is over */
export function isMatchOver(match: MatchState): { over: boolean; winner: Player | null } {
  if (match.whiteScore >= match.matchLength) {
    return { over: true, winner: "white" };
  }
  if (match.blackScore >= match.matchLength) {
    return { over: true, winner: "black" };
  }
  return { over: false, winner: null };
}

/** Check if the current game is a Crawford game (no doubling allowed) */
export function isCrawfordGame(match: MatchState): boolean {
  return match.isCrawford;
}

/** Get points needed to win for each player */
export function pointsToWin(match: MatchState): { white: number; black: number } {
  return {
    white: Math.max(0, match.matchLength - match.whiteScore),
    black: Math.max(0, match.matchLength - match.blackScore),
  };
}
