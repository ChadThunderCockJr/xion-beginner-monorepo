import { randomBytes } from "node:crypto";

// Nonce store with TTL
const nonceStore = new Map<string, { createdAt: number }>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of nonceStore) {
    if (now - data.createdAt > NONCE_TTL_MS) {
      nonceStore.delete(nonce);
    }
  }
}, 60_000);

/** Generate a single-use nonce for auth challenge */
export function generateNonce(): string {
  const nonce = randomBytes(32).toString("hex") + ":" + Date.now();
  nonceStore.set(nonce, { createdAt: Date.now() });
  return nonce;
}

/** Consume a nonce (single-use) - returns true if valid */
function consumeNonce(nonce: string): boolean {
  const data = nonceStore.get(nonce);
  if (!data) return false;
  if (Date.now() - data.createdAt > NONCE_TTL_MS) {
    nonceStore.delete(nonce);
    return false;
  }
  nonceStore.delete(nonce); // single-use
  return true;
}

/**
 * Construct an ADR-36 sign doc for arbitrary message signing.
 * ADR-36 uses a StdSignDoc with empty fee/msgs except one MsgSignData.
 */
function makeADR36SignDoc(signer: string, data: string) {
  return {
    chain_id: "",
    account_number: "0",
    sequence: "0",
    fee: { gas: "0", amount: [] },
    msgs: [
      {
        type: "sign/MsgSignData",
        value: {
          signer,
          data: Buffer.from(data).toString("base64"),
        },
      },
    ],
    memo: "",
  };
}

/**
 * Verify a wallet signature using ADR-36 (Cosmos arbitrary message signing).
 * Manually constructs the ADR-36 sign doc and verifies using secp256k1.
 */
export async function verifySignature(
  address: string,
  nonce: string,
  signature: string,
  pubkey: string,
): Promise<boolean> {
  // Validate nonce is valid and not expired
  if (!consumeNonce(nonce)) {
    return false;
  }

  try {
    const { Secp256k1, Sha256 } = await import("@cosmjs/crypto");
    const { pubkeyToAddress, encodeSecp256k1Pubkey, serializeSignDoc } = await import("@cosmjs/amino");

    const pubkeyBytes = Buffer.from(pubkey, "base64");
    const sigBytes = Buffer.from(signature, "base64");

    // Verify pubkey derives to the claimed address
    const aminoPubkey = encodeSecp256k1Pubkey(pubkeyBytes);
    const derivedAddress = pubkeyToAddress(aminoPubkey, "xion");
    if (derivedAddress !== address) {
      console.error("[Auth] Pubkey does not match address:", derivedAddress, "vs", address);
      return false;
    }

    // Construct the ADR-36 sign doc and serialize it
    const signDoc = makeADR36SignDoc(address, nonce);
    const signBytes = serializeSignDoc(signDoc);

    // Hash the sign doc (Cosmos signs SHA-256 of the serialized doc)
    const messageHash = new Sha256(signBytes).digest();

    // Verify the secp256k1 signature
    // @cosmjs/crypto Secp256k1 expects a 64-byte signature (r + s, no recovery byte)
    const sig = sigBytes.length === 65 ? sigBytes.slice(0, 64) : sigBytes;

    const valid = await Secp256k1.verifySignature(
      { r: sig.slice(0, 32), s: sig.slice(32, 64) } as never,
      messageHash,
      pubkeyBytes,
    );

    return valid;
  } catch (err) {
    console.error("[Auth] Signature verification failed:", err);
    return false;
  }
}

/**
 * Simple fallback for development: trust the address without verification.
 * Used when SKIP_AUTH_VERIFICATION env var is set.
 */
export function isAuthSkipped(): boolean {
  return process.env.SKIP_AUTH_VERIFICATION === "true";
}
