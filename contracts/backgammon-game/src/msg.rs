use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

#[cw_serde]
pub struct InstantiateMsg {
    pub escrow_contract: Option<String>,
    pub server_address: Option<String>,
    pub usdc_denom: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Create a new game. Also creates an escrow if escrow_contract is set.
    CreateGame {
        opponent: String,
        wager_amount: u128,
    },

    /// Mark game as in progress (both players deposited)
    StartGame {
        game_id: String,
    },

    /// Report game result. Only callable by server_address or admin.
    /// Updates player stats and triggers escrow settlement.
    ReportResult {
        game_id: String,
        winner: String,
        result_type: String, // "normal", "gammon", or "backgammon"
        move_count: u32,
    },

    /// Report game abandonment (disconnect/timeout).
    /// Only callable by server_address or admin.
    ReportAbandonment {
        game_id: String,
        abandoner: String,
    },

    /// Admin: update configuration
    UpdateConfig {
        escrow_contract: Option<String>,
        server_address: Option<String>,
    },
}

#[cw_serde]
pub struct MigrateMsg {}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},

    #[returns(GameResponse)]
    Game { game_id: String },

    #[returns(PlayerStatsResponse)]
    PlayerStats { address: String },

    #[returns(StatsResponse)]
    Stats {},

    #[returns(GamesListResponse)]
    PlayerGames {
        address: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
}

#[cw_serde]
pub struct ConfigResponse {
    pub admin: Addr,
    pub escrow_contract: Option<Addr>,
    pub server_address: Option<Addr>,
    pub usdc_denom: String,
}

#[cw_serde]
pub struct GameResponse {
    pub game_id: String,
    pub player_a: Addr,
    pub player_b: Addr,
    pub wager_amount: u128,
    pub status: String,
    pub winner: Option<Addr>,
    pub result_type: Option<String>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub move_count: u32,
}

#[cw_serde]
pub struct PlayerStatsResponse {
    pub address: Addr,
    pub games_played: u32,
    pub games_won: u32,
    pub rating: u32,
    pub total_wagered: u128,
    pub total_won: u128,
}

#[cw_serde]
pub struct StatsResponse {
    pub total_games: u64,
}

#[cw_serde]
pub struct GamesListResponse {
    pub games: Vec<GameResponse>,
}
