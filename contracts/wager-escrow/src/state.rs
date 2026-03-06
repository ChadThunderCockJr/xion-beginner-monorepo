use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    /// Only the game contract can settle matches
    pub game_contract: Option<Addr>,
    /// Wager token denom (Gammon token factory denom or IBC USDC)
    pub usdc_denom: String,
    /// Rake in basis points (e.g., 250 = 2.5%)
    pub rake_bps: u16,
    /// Platform treasury that receives rake
    pub rake_recipient: Addr,
    /// Minimum wager in micro units
    pub min_wager: u128,
    /// Maximum wager in micro units
    pub max_wager: u128,
    /// Seconds before timeout forfeit is allowed
    pub timeout_seconds: u64,
}

#[cw_serde]
pub struct Escrow {
    pub game_id: String,
    pub player_a: Addr,
    pub player_b: Addr,
    /// Wager amount per player in micro units (base wager)
    pub wager_amount: u128,
    /// Cumulative amount deposited by player A
    pub player_a_deposited: u128,
    /// Cumulative amount deposited by player B
    pub player_b_deposited: u128,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub settled_at: Option<u64>,
    /// Current doubling cube value (1, 2, 4, 8, ... up to 64)
    pub cube_value: u32,
    /// Pending double offer awaiting deposits from both players
    pub pending_double: Option<PendingDouble>,
}

#[cw_serde]
pub struct PendingDouble {
    /// Address of the player who offered the double
    pub doubler: Addr,
    /// Address of the player who must respond
    pub responder: Addr,
    /// New cube value after double completes
    pub new_cube_value: u32,
    /// Additional deposit required from each player
    pub additional_deposit: u128,
    /// Whether the doubler has deposited the additional amount
    pub doubler_deposited: bool,
    /// Whether the responder has deposited the additional amount
    pub responder_deposited: bool,
}

#[cw_serde]
pub enum EscrowStatus {
    /// Waiting for both players to deposit
    AwaitingDeposits,
    /// Both deposited, game in progress
    Active,
    /// Waiting for both players to deposit additional funds after accepting a double
    AwaitingDoubleDeposits,
    /// Winner has been paid
    Settled,
    /// Both players refunded
    Cancelled,
    /// Non-depositing player forfeited
    TimedOut,
    /// Game forfeited (e.g., double rejected)
    Forfeited,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const ESCROWS: Map<&str, Escrow> = Map::new("escrows");
pub const TOTAL_RAKE_COLLECTED: Item<u128> = Item::new("total_rake");
pub const TOTAL_GAMES_SETTLED: Item<u64> = Item::new("total_settled");
