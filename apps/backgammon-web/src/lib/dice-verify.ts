/**
 * Client-side dice verification for the commit-reveal protocol.
 * Mirrors the server's dice derivation so players can independently verify.
 */

/** Verify a single dice roll against its commit-reveal proof */
export async function verifyDiceRoll(params: {
  commitHash: string;
  serverSeed: string;
  clientSeed: string;
  turnNumber: number;
  dice: [number, number];
}): Promise<{ valid: boolean; details: string }> {
  const { commitHash, serverSeed, clientSeed, turnNumber, dice } = params;

  // 1. Verify commit hash matches server seed
  const encoder = new TextEncoder();
  const seedData = encoder.encode(serverSeed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", seedData);
  const hashArray = new Uint8Array(hashBuffer);
  const expectedCommit = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedCommit !== commitHash) {
    return {
      valid: false,
      details: `Commit hash mismatch: expected ${expectedCommit}, got ${commitHash}`,
    };
  }

  // 2. Verify dice derivation
  const combinedData = encoder.encode(serverSeed + clientSeed + String(turnNumber));
  const diceBuffer = await crypto.subtle.digest("SHA-256", combinedData);
  const diceBytes = new Uint8Array(diceBuffer);
  const expectedDie1 = (diceBytes[0] % 6) + 1;
  const expectedDie2 = (diceBytes[1] % 6) + 1;

  if (expectedDie1 !== dice[0] || expectedDie2 !== dice[1]) {
    return {
      valid: false,
      details: `Dice mismatch: expected [${expectedDie1}, ${expectedDie2}], got [${dice[0]}, ${dice[1]}]`,
    };
  }

  return { valid: true, details: "All checks passed" };
}

export interface DiceProof {
  turnNumber: number;
  serverSeed: string;
  clientSeed: string;
  commitHash: string;
  dice: [number, number];
}
