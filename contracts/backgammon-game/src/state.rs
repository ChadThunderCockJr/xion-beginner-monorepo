use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    /// Wager escrow contract address
    pub escrow_contract: Option<Addr>,
    /// Authorized game server address (can report results)
    pub server_address: Option<Addr>,
    /// USDC denom for wager creation
    pub usdc_denom: String,
}

#[cw_serde]
pub struct Game {
    pub game_id: String,
    pub player_a: Addr,
    pub player_b: Addr,
    pub wager_amount: u128,
    pub status: GameStatus,
    pub winner: Option<Addr>,
    pub result_type: Option<ResultType>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub move_count: u32,
}

#[cw_serde]
pub enum GameStatus {
    Created,
    InProgress,
    Completed,
    Abandoned,
}

#[cw_serde]
pub enum ResultType {
    Normal,
    Gammon,
    Backgammon,
}

#[cw_serde]
pub struct PlayerStats {
    pub address: Addr,
    pub games_played: u32,
    pub games_won: u32,
    /// Rating stored as integer (actual rating * 100, e.g., 1500.00 = 150000)
    pub rating: u32,
    pub total_wagered: u128,
    pub total_won: u128,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const GAMES: Map<&str, Game> = Map::new("games");
pub const PLAYER_STATS: Map<&Addr, PlayerStats> = Map::new("player_stats");
pub const TOTAL_GAMES: Item<u64> = Item::new("total_games");
pub const GAME_COUNTER: Item<u64> = Item::new("game_counter");
