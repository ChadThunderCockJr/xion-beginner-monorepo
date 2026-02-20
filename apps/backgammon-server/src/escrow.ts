import { logger } from "./logger.js";

export type EscrowStatus = "none" | "pending_deposits" | "active" | "settled" | "cancelled";

export interface EscrowInfo {
  gameId: string;
  playerA: string;
  playerB: string;
  wagerAmount: string;
  status: EscrowStatus;
  playerADeposited: boolean;
  playerBDeposited: boolean;
}

/**
 * EscrowClient communicates with the wager-escrow CosmWasm contract.
 * Uses @cosmjs/cosmwasm-stargate for contract interactions.
 */
export class EscrowClient {
  private rpcUrl: string;
  private contractAddress: string;
  private adminMnemonic: string;
  private initialized = false;
  private signingClient: any = null;
  private adminAddress: string = "";

  constructor(rpcUrl: string, contractAddress: string, adminMnemonic: string) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.adminMnemonic = adminMnemonic;
  }

  /** Initialize the signing client (lazy, called on first use) */
  private async init(): Promise<boolean> {
    if (this.initialized) return !!this.signingClient;
    this.initialized = true;

    try {
      const { SigningCosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
      const { DirectSecp256k1HdWallet } = await import("@cosmjs/proto-signing");
      const { GasPrice } = await import("@cosmjs/stargate");

      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.adminMnemonic, {
        prefix: "xion",
      });
      const [account] = await wallet.getAccounts();
      this.adminAddress = account.address;

      this.signingClient = await SigningCosmWasmClient.connectWithSigner(
        this.rpcUrl,
        wallet,
        { gasPrice: GasPrice.fromString("0.025uxion") },
      );

      logger.info("Escrow client initialized", { admin: this.adminAddress });
      return true;
    } catch (err) {
      logger.error("Failed to initialize escrow client", { error: String(err) });
      return false;
    }
  }

  /** Create an escrow for a game */
  async createEscrow(
    gameId: string,
    playerA: string,
    playerB: string,
    wagerAmount: string,
    denom: string = "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4", // USDC on XION
  ): Promise<boolean> {
    if (!(await this.init())) return false;

    try {
      const msg = {
        create_escrow: {
          game_id: gameId,
          player_a: playerA,
          player_b: playerB,
          wager_amount: wagerAmount,
          denom,
        },
      };

      await this.signingClient.execute(
        this.adminAddress,
        this.contractAddress,
        msg,
        "auto",
      );

      logger.info("Escrow created", { gameId, playerA, playerB, wagerAmount });
      return true;
    } catch (err) {
      logger.error("Failed to create escrow", { gameId, error: String(err) });
      return false;
    }
  }

  /** Query escrow status */
  async queryEscrowStatus(gameId: string): Promise<EscrowInfo | null> {
    if (!(await this.init())) return null;

    try {
      const result = await this.signingClient.queryContractSmart(
        this.contractAddress,
        { escrow: { game_id: gameId } },
      );

      return {
        gameId: result.game_id,
        playerA: result.player_a,
        playerB: result.player_b,
        wagerAmount: String(result.wager_amount),
        status: mapContractStatus(result.status),
        playerADeposited: result.player_a_deposited ?? false,
        playerBDeposited: result.player_b_deposited ?? false,
      };
    } catch (err) {
      logger.error("Failed to query escrow", { gameId, error: String(err) });
      return null;
    }
  }

  /** Settle the escrow -- send winnings to the winner */
  async settle(
    gameId: string,
    winner: string,
    multiplier: number = 1,
  ): Promise<boolean> {
    if (!(await this.init())) return false;

    try {
      const msg = multiplier > 1
        ? {
            settle_with_multiplier: {
              game_id: gameId,
              winner,
              multiplier: String(multiplier),
            },
          }
        : {
            settle: {
              game_id: gameId,
              winner,
            },
          };

      await this.signingClient.execute(
        this.adminAddress,
        this.contractAddress,
        msg,
        "auto",
      );

      logger.info("Escrow settled", { gameId, winner, multiplier });
      return true;
    } catch (err) {
      logger.error("Failed to settle escrow", { gameId, error: String(err) });
      return false;
    }
  }

  /** Cancel the escrow -- refund both players */
  async cancel(gameId: string): Promise<boolean> {
    if (!(await this.init())) return false;

    try {
      await this.signingClient.execute(
        this.adminAddress,
        this.contractAddress,
        { cancel: { game_id: gameId } },
        "auto",
      );

      logger.info("Escrow cancelled", { gameId });
      return true;
    } catch (err) {
      logger.error("Failed to cancel escrow", { gameId, error: String(err) });
      return false;
    }
  }

  /** Query a player's token balance */
  async queryBalance(address: string, denom: string = "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"): Promise<string> {
    if (!(await this.init())) return "0";

    try {
      const { StargateClient } = await import("@cosmjs/stargate");
      const client = await StargateClient.connect(this.rpcUrl);
      const balance = await client.getBalance(address, denom);
      return balance.amount;
    } catch (err) {
      logger.error("Failed to query balance", { address, error: String(err) });
      return "0";
    }
  }
}

/** Map contract status enum to our status type */
function mapContractStatus(status: any): EscrowStatus {
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "awaiting_deposits" || s === "pending_deposits" || s === "pending") return "pending_deposits";
    if (s === "active" || s === "funded") return "active";
    if (s === "settled" || s === "completed") return "settled";
    if (s === "cancelled" || s === "canceled" || s === "timed_out") return "cancelled";
  }
  // Handle Rust enum as object: { awaiting_deposits: {} } or { active: {} }
  if (typeof status === "object") {
    const keys = Object.keys(status);
    if (keys.length > 0) {
      return mapContractStatus(keys[0]);
    }
  }
  return "none";
}

/** Get the settlement multiplier based on result type and cube value */
export function getSettlementMultiplier(
  resultType: "normal" | "gammon" | "backgammon",
  cubeValue: number,
): number {
  const resultMultiplier = resultType === "backgammon" ? 3 : resultType === "gammon" ? 2 : 1;
  return resultMultiplier * cubeValue;
}

/** Create a singleton escrow client from environment variables */
let escrowClientInstance: EscrowClient | null = null;

export function getEscrowClient(): EscrowClient | null {
  if (escrowClientInstance) return escrowClientInstance;

  const rpcUrl = process.env.XION_RPC_URL;
  const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  const adminMnemonic = process.env.ESCROW_ADMIN_MNEMONIC;

  if (!rpcUrl || !contractAddress || !adminMnemonic) {
    logger.warn("Escrow client not configured -- missing XION_RPC_URL, ESCROW_CONTRACT_ADDRESS, or ESCROW_ADMIN_MNEMONIC");
    return null;
  }

  escrowClientInstance = new EscrowClient(rpcUrl, contractAddress, adminMnemonic);
  return escrowClientInstance;
}
