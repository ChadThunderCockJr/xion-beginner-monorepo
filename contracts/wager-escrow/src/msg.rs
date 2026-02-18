use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

#[cw_serde]
pub struct InstantiateMsg {
    pub usdc_denom: String,
    pub rake_bps: u16,
    pub rake_recipient: String,
    pub min_wager: u128,
    pub max_wager: u128,
    pub timeout_seconds: u64,
    pub game_contract: Option<String>,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Create a new escrow for a game match
    CreateEscrow {
        game_id: String,
        player_a: String,
        player_b: String,
        wager_amount: u128,
    },

    /// Deposit wager into escrow. Send USDC with this message.
    Deposit { game_id: String },

    /// Settle the game and pay the winner. Called by game contract or admin.
    Settle {
        game_id: String,
        winner: String,
    },

    /// Settle with a multiplier (for gammon=2x, backgammon=3x).
    /// The multiplier affects the rake calculation but not the payout
    /// since both players deposited the same amount.
    SettleWithMultiplier {
        game_id: String,
        winner: String,
        multiplier: u32,
    },

    /// Cancel game and refund both players. Called by game contract or admin.
    Cancel { game_id: String },

    /// Claim timeout if opponent hasn't deposited within timeout period.
    ClaimTimeout { game_id: String },

    /// Admin: update configuration
    UpdateConfig {
        game_contract: Option<String>,
        rake_bps: Option<u16>,
        rake_recipient: Option<String>,
        min_wager: Option<u128>,
        max_wager: Option<u128>,
        timeout_seconds: Option<u64>,
    },
}

#[cw_serde]
pub struct MigrateMsg {}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},

    #[returns(EscrowResponse)]
    Escrow { game_id: String },

    #[returns(StatsResponse)]
    Stats {},
}

#[cw_serde]
pub struct ConfigResponse {
    pub admin: Addr,
    pub game_contract: Option<Addr>,
    pub usdc_denom: String,
    pub rake_bps: u16,
    pub rake_recipient: Addr,
    pub min_wager: u128,
    pub max_wager: u128,
    pub timeout_seconds: u64,
}

#[cw_serde]
pub struct EscrowResponse {
    pub game_id: String,
    pub player_a: Addr,
    pub player_b: Addr,
    pub wager_amount: u128,
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
    pub status: String,
    pub created_at: u64,
    pub settled_at: Option<u64>,
}

#[cw_serde]
pub struct StatsResponse {
    pub total_rake_collected: u128,
    pub total_games_settled: u64,
}
