import {
  XION_REST as _XION_REST,
} from "@xion-beginner/xion-config";

// Re-export shared XION utilities
export {
  XION_CHAIN_ID,
  XION_RPC,
  XION_REST,
  USDC_DENOM,
  formatUSDC,
  parseUSDC,
  shortenAddress,
} from "@xion-beginner/xion-config";

// Project-specific constants
export const ENTRY_FEE_AMOUNT = "8000000"; // $8 USDC
export const REFERRAL_REWARD = "5000000"; // $5 USDC
export const PLATFORM_FEE = "3000000"; // $3 USDC

// Contract addresses (from env vars)
export const PYRAMID_CONTRACT = process.env.NEXT_PUBLIC_PYRAMID_CONTRACT || "";
export const TREASURY_CONTRACT =
  process.env.NEXT_PUBLIC_TREASURY_CONTRACT || "";
export const CROSSMINT_COLLECTION_ID =
  process.env.NEXT_PUBLIC_CROSSMINT_COLLECTION_ID || "";

// Transaction verification

/**
 * Verify a transaction hash on-chain via the XION REST API.
 * Checks that:
 * 1. The transaction exists and succeeded
 * 2. It contains a MsgExecuteContract to PYRAMID_CONTRACT
 * 3. The sender matches the claimed wallet address
 * Returns { valid: true } or { valid: false, reason: string }
 */
export async function verifyTransaction(
  txHash: string,
  expectedSender: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!PYRAMID_CONTRACT) {
    return { valid: false, reason: "Contract not configured" };
  }

  try {
    const url = `${_XION_REST}/cosmos/tx/v1beta1/txs/${txHash}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        return { valid: false, reason: "Transaction not found on-chain" };
      }
      return { valid: false, reason: `Failed to query transaction: ${res.status}` };
    }

    const data = await res.json();
    const tx = data.tx_response;

    // Check transaction succeeded
    if (tx.code !== 0) {
      return { valid: false, reason: "Transaction failed on-chain" };
    }

    // Check for a MsgExecuteContract message targeting our contract
    const messages = data.tx?.body?.messages || [];
    const hasValidMsg = messages.some(
      (msg: { "@type"?: string; contract?: string; sender?: string }) => {
        const isMsgExecute =
          msg["@type"] === "/cosmwasm.wasm.v1.MsgExecuteContract";
        const isCorrectContract = msg.contract === PYRAMID_CONTRACT;
        const isCorrectSender =
          msg.sender?.toLowerCase() === expectedSender.toLowerCase();
        return isMsgExecute && isCorrectContract && isCorrectSender;
      },
    );

    if (!hasValidMsg) {
      return {
        valid: false,
        reason: "Transaction does not contain a valid contract execution for this sender",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Transaction verification failed:", error);
    return { valid: false, reason: "Transaction verification error" };
  }
}

// Project-specific helpers

export function generateReferralLink(walletAddress: string): string {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${baseUrl}/?ref=${walletAddress}`;
}

// Project-specific contract queries (use REST API directly, no CosmJS needed)

export async function queryMember(
  address: string,
): Promise<{
  is_member: boolean;
  member?: { referral_count: number; total_earned: string };
}> {
  if (!PYRAMID_CONTRACT) throw new Error("Contract not configured");
  const query = btoa(JSON.stringify({ member: { address } }));
  const url = `${_XION_REST}/cosmwasm/wasm/v1/contract/${PYRAMID_CONTRACT}/smart/${query}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to query member");
  const data = await res.json();
  return data.data;
}

export async function queryStats(): Promise<{
  total_members: number;
  total_paid_out: string;
}> {
  if (!PYRAMID_CONTRACT) throw new Error("Contract not configured");
  const query = btoa(JSON.stringify({ stats: {} }));
  const url = `${_XION_REST}/cosmwasm/wasm/v1/contract/${PYRAMID_CONTRACT}/smart/${query}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to query stats");
  const data = await res.json();
  return data.data;
}
