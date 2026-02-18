use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Already a member")]
    AlreadyMember {},

    #[error("Referrer not found")]
    ReferrerNotFound {},

    #[error("Invalid payment: expected {expected} {denom}, received {received}")]
    InvalidPayment {
        expected: u128,
        received: u128,
        denom: String,
    },

    #[error("No payment received")]
    NoPayment {},

    #[error("Cannot refer yourself")]
    SelfReferral {},

    #[error("Insufficient contract balance: need {needed}, have {available}")]
    InsufficientBalance { needed: u128, available: u128 },

    #[error("Crossmint NFT contract not configured")]
    NftContractNotConfigured {},

    #[error("Caller does not own a Crossmint NFT")]
    NoNftOwnership {},
}
