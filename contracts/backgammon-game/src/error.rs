use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Game not found: {game_id}")]
    GameNotFound { game_id: String },

    #[error("Game already exists: {game_id}")]
    GameAlreadyExists { game_id: String },

    #[error("Invalid game status: expected {expected}, got {got}")]
    InvalidGameStatus { expected: String, got: String },

    #[error("Winner must be a player in the game")]
    InvalidWinner {},

    #[error("Invalid result type: {result_type}")]
    InvalidResultType { result_type: String },

    #[error("Cannot play against yourself")]
    SelfPlay {},
}
