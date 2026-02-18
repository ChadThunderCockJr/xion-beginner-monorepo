use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    /// Only the game contract can settle matches
    pub game_contract: Option<Addr>,
    /// IBC USDC denom on XION
    pub usdc_denom: String,
    /// Rake in basis points (e.g., 250 = 2.5%)
    pub rake_bps: u16,
    /// Platform treasury that receives rake
    pub rake_recipient: Addr,
    /// Minimum wager in micro-USDC
    pub min_wager: u128,
    /// Maximum wager in micro-USDC
    pub max_wager: u128,
    /// Seconds before timeout forfeit is allowed
    pub timeout_seconds: u64,
}

#[cw_serde]
pub struct Escrow {
    pub game_id: String,
    pub player_a: Addr,
    pub player_b: Addr,
    /// Wager amount per player in micro-USDC
    pub wager_amount: u128,
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub settled_at: Option<u64>,
}

#[cw_serde]
pub enum EscrowStatus {
    /// Waiting for both players to deposit
    AwaitingDeposits,
    /// Both deposited, game in progress
    Active,
    /// Winner has been paid
    Settled,
    /// Both players refunded
    Cancelled,
    /// Non-depositing player forfeited
    TimedOut,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const ESCROWS: Map<&str, Escrow> = Map::new("escrows");
pub const TOTAL_RAKE_COLLECTED: Item<u128> = Item::new("total_rake");
pub const TOTAL_GAMES_SETTLED: Item<u64> = Item::new("total_settled");
