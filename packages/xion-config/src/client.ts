import type { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { XION_RPC } from "./constants";

let clientInstance: CosmWasmClient | null = null;

/**
 * Get a read-only CosmWasm client.
 * Caches the client instance for reuse.
 * Requires @cosmjs/cosmwasm-stargate as a peer dependency.
 */
export async function getClient(): Promise<CosmWasmClient> {
  if (!clientInstance) {
    const { CosmWasmClient: CWClient } = await import(
      "@cosmjs/cosmwasm-stargate"
    );
    const rpcUrl =
      process.env.NEXT_PUBLIC_RPC || process.env.XION_RPC || XION_RPC;
    clientInstance = await CWClient.connect(rpcUrl);
  }
  return clientInstance;
}

/**
 * Query a smart contract.
 */
export async function queryContract<T>(
  contractAddress: string,
  queryMsg: object,
): Promise<T> {
  const client = await getClient();
  return client.queryContractSmart(contractAddress, queryMsg);
}

/**
 * Get contract info (code ID, creator, admin).
 */
export async function getContractInfo(contractAddress: string) {
  const client = await getClient();
  return client.getContract(contractAddress);
}

/**
 * Get account balance.
 */
export async function getBalance(address: string, denom = "uxion") {
  const client = await getClient();
  return client.getBalance(address, denom);
}
