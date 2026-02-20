import { createHash, randomBytes } from "node:crypto";

export interface DiceCommit {
  serverSeed: string;
  commitHash: string;
  clientSeed: string;
  turnNumber: number;
  dice: [number, number] | null; // null until revealed
}

/** Generate a server seed and its commitment hash */
export function createCommit(turnNumber: number): { serverSeed: string; commitHash: string } {
  const serverSeed = randomBytes(32).toString("hex");
  // Commit is hash of serverSeed alone — clientSeed not yet known
  const commitHash = createHash("sha256")
    .update(serverSeed)
    .digest("hex");
  return { serverSeed, commitHash };
}

/** Derive deterministic dice from combined seeds */
export function deriveDice(serverSeed: string, clientSeed: string, turnNumber: number): [number, number] {
  const combined = createHash("sha256")
    .update(serverSeed + clientSeed + String(turnNumber))
    .digest();

  // Use first 2 bytes to derive dice values (1-6)
  const die1 = (combined[0] % 6) + 1;
  const die2 = (combined[1] % 6) + 1;
  return [die1, die2];
}

/** Verify that dice were derived correctly from the seeds */
export function verifyDice(
  commitHash: string,
  serverSeed: string,
  clientSeed: string,
  turnNumber: number,
  dice: [number, number],
): boolean {
  // 1. Verify the commit hash matches the server seed
  const expectedHash = createHash("sha256")
    .update(serverSeed)
    .digest("hex");
  if (expectedHash !== commitHash) return false;

  // 2. Verify the dice were derived correctly
  const expectedDice = deriveDice(serverSeed, clientSeed, turnNumber);
  return expectedDice[0] === dice[0] && expectedDice[1] === dice[1];
}

/** Stores commit history for a game */
export class GameDiceHistory {
  private commits: Map<number, DiceCommit> = new Map(); // turnNumber -> commit

  /** Create a new commit for a turn */
  createTurnCommit(turnNumber: number): { commitHash: string } {
    const { serverSeed, commitHash } = createCommit(turnNumber);
    this.commits.set(turnNumber, {
      serverSeed,
      commitHash,
      clientSeed: "",
      turnNumber,
      dice: null,
    });
    return { commitHash };
  }

  /** Reveal dice for a turn given the client seed */
  revealDice(turnNumber: number, clientSeed: string): { dice: [number, number]; serverSeed: string; commitHash: string } | null {
    const commit = this.commits.get(turnNumber);
    if (!commit) return null;
    if (commit.dice !== null) return null; // already revealed

    const dice = deriveDice(commit.serverSeed, clientSeed, turnNumber);
    commit.clientSeed = clientSeed;
    commit.dice = dice;
    return { dice, serverSeed: commit.serverSeed, commitHash: commit.commitHash };
  }

  /** Get full history for verification (all revealed turns) */
  getHistory(): Array<{
    turnNumber: number;
    serverSeed: string;
    clientSeed: string;
    commitHash: string;
    dice: [number, number];
  }> {
    const result: Array<{
      turnNumber: number;
      serverSeed: string;
      clientSeed: string;
      commitHash: string;
      dice: [number, number];
    }> = [];

    for (const [, commit] of this.commits) {
      if (commit.dice) {
        result.push({
          turnNumber: commit.turnNumber,
          serverSeed: commit.serverSeed,
          clientSeed: commit.clientSeed,
          commitHash: commit.commitHash,
          dice: commit.dice,
        });
      }
    }

    return result.sort((a, b) => a.turnNumber - b.turnNumber);
  }
}
