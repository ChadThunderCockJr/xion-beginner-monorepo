import { useState, useCallback } from "react";
import { useAuth } from "./useAuth";

/**
 * Hook to fetch and display the user's USDC balance.
 *
 * TODO: Replace the stub implementation with a real chain balance query.
 * To query the actual USDC balance on XION, use the Abstraxion signing client
 * or a CosmWasm query client to call the USDC token contract's `balance` query
 * with the user's bech32 address. Example:
 *
 *   const client = await getQueryClient();
 *   const { balance } = await client.queryContractSmart(USDC_CONTRACT, {
 *     balance: { address }
 *   });
 *   // balance is in micro-units; divide by 1e6 and format to 2 decimals
 */
export function useBalance() {
  const { address, isConnected } = useAuth();
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // TODO: Replace with real chain balance query using Abstraxion query client
  const balance: string | null = isConnected && address ? "0.00" : null;

  const refetch = useCallback(() => {
    // TODO: Implement refetch once real balance query is added
  }, []);

  return { balance, isLoading, error, refetch };
}
