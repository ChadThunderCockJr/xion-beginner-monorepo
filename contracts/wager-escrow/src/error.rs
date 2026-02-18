use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Escrow already exists for game {game_id}")]
    EscrowAlreadyExists { game_id: String },

    #[error("Escrow not found for game {game_id}")]
    EscrowNotFound { game_id: String },

    #[error("Invalid wager: {amount} not in range [{min}, {max}]")]
    InvalidWager { amount: u128, min: u128, max: u128 },

    #[error("Invalid payment: expected {expected} {denom}, received {received}")]
    InvalidPayment {
        expected: u128,
        received: u128,
        denom: String,
    },

    #[error("No payment received")]
    NoPayment {},

    #[error("Player already deposited")]
    AlreadyDeposited {},

    #[error("Player is not part of this game")]
    NotAPlayer {},

    #[error("Invalid escrow status: expected {expected}, got {got}")]
    InvalidEscrowStatus { expected: String, got: String },

    #[error("Timeout not reached: {remaining} seconds remaining")]
    TimeoutNotReached { remaining: u64 },

    #[error("Winner must be one of the players")]
    InvalidWinner {},

    #[error("Insufficient contract balance: need {needed}, have {available}")]
    InsufficientBalance { needed: u128, available: u128 },
}
