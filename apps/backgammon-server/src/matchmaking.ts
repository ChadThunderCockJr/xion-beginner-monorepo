import type { MatchmakingEntry, PlayerConnection } from "./types.js";
import type { GameManager } from "./game-manager.js";

export class Matchmaker {
  private queue: MatchmakingEntry[] = [];
  private ratingRange = 200; // Match within this rating range

  constructor(private gameManager: GameManager) {}

  addToQueue(entry: MatchmakingEntry): { matched: boolean; gameId?: string; opponent?: MatchmakingEntry; matchLength?: number } {
    // Check if already in queue
    const existing = this.queue.findIndex(e => e.address === entry.address);
    if (existing !== -1) {
      this.queue.splice(existing, 1);
    }

    // Try to find a match
    const match = this.findMatch(entry);
    if (match) {
      this.queue.splice(this.queue.indexOf(match), 1);

      // Create a game
      const game = this.gameManager.createGame(entry.wagerAmount);
      const white: PlayerConnection = {
        ws: entry.ws,
        address: entry.address,
        rating: entry.rating,
        connectedAt: entry.joinedAt,
      };
      const black: PlayerConnection = {
        ws: match.ws,
        address: match.address,
        rating: match.rating,
        connectedAt: match.joinedAt,
      };

      this.gameManager.joinGame(game.id, white);
      this.gameManager.joinGame(game.id, black);

      // Use the higher matchLength of the two players (both should match anyway)
      const matchLength = Math.max(entry.matchLength, match.matchLength);

      return { matched: true, gameId: game.id, opponent: match, matchLength };
    }

    // No match found, add to queue
    this.queue.push(entry);
    return { matched: false };
  }

  removeFromQueue(address: string): boolean {
    const idx = this.queue.findIndex(e => e.address === address);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  getQueuePosition(address: string): number {
    return this.queue.findIndex(e => e.address === address) + 1;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  private findMatch(entry: MatchmakingEntry): MatchmakingEntry | null {
    const candidates: MatchmakingEntry[] = [];
    for (const candidate of this.queue) {
      if (candidate.address === entry.address) continue;
      if (candidate.wagerAmount !== entry.wagerAmount) continue;
      if (candidate.matchLength !== entry.matchLength) continue;
      if (Math.abs(candidate.rating - entry.rating) <= this.ratingRange) {
        candidates.push(candidate);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
