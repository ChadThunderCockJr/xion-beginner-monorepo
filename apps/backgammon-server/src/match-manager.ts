import {
  createGameState,
  createMatch,
  scoreGame,
  isMatchOver,
  isCrawfordGame,
  type GameState,
  type MatchState,
  type Player,
  type ResultType,
} from "@xion-beginner/backgammon-core";
import type { ServerMessage } from "./types.js";

export interface ServerMatch {
  id: string;
  matchState: MatchState;
  currentGameId: string;
  playerWhiteAddress: string;
  playerBlackAddress: string;
  wagerAmount: number;
  status: "playing" | "finished";
}

export class MatchManager {
  private matches = new Map<string, ServerMatch>();
  private gameToMatch = new Map<string, string>(); // gameId -> matchId

  createMatch(
    matchId: string,
    matchLength: number,
    playerWhite: string,
    playerBlack: string,
    initialGameId: string,
    wagerAmount: number = 0,
  ): ServerMatch {
    const match: ServerMatch = {
      id: matchId,
      matchState: createMatch(matchLength),
      currentGameId: initialGameId,
      playerWhiteAddress: playerWhite,
      playerBlackAddress: playerBlack,
      wagerAmount,
      status: "playing",
    };
    this.matches.set(matchId, match);
    this.gameToMatch.set(initialGameId, matchId);
    return match;
  }

  getMatch(matchId: string): ServerMatch | undefined {
    return this.matches.get(matchId);
  }

  getMatchForGame(gameId: string): ServerMatch | undefined {
    const matchId = this.gameToMatch.get(gameId);
    if (!matchId) return undefined;
    return this.matches.get(matchId);
  }

  /** Score a completed game within a match. Returns match result info. */
  scoreGame(
    gameId: string,
    winner: Player,
    resultType: ResultType,
    cubeValue: number,
  ): {
    matchOver: boolean;
    matchWinner: Player | null;
    matchState: MatchState;
    isCrawfordNext: boolean;
  } | null {
    const matchId = this.gameToMatch.get(gameId);
    if (!matchId) return null;

    const match = this.matches.get(matchId);
    if (!match || match.status !== "playing") return null;

    match.matchState = scoreGame(match.matchState, winner, resultType, cubeValue);
    const result = isMatchOver(match.matchState);

    if (result.over) {
      match.status = "finished";
    }

    return {
      matchOver: result.over,
      matchWinner: result.winner,
      matchState: match.matchState,
      isCrawfordNext: isCrawfordGame(match.matchState),
    };
  }

  /** Set the current game ID for the next game in the match */
  setCurrentGame(matchId: string, gameId: string): void {
    const match = this.matches.get(matchId);
    if (match) {
      match.currentGameId = gameId;
      this.gameToMatch.set(gameId, matchId);
    }
  }

  /** Check if doubling is allowed (Crawford rule) */
  isDoublingAllowed(gameId: string): boolean {
    const match = this.getMatchForGame(gameId);
    if (!match) return true; // not a match game, doubling allowed
    return !isCrawfordGame(match.matchState);
  }

  removeMatch(matchId: string): void {
    const match = this.matches.get(matchId);
    if (match) {
      // Clean up game-to-match mappings
      for (const [gId, mId] of this.gameToMatch) {
        if (mId === matchId) this.gameToMatch.delete(gId);
      }
      this.matches.delete(matchId);
    }
  }
}
