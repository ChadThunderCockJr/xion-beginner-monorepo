use cosmwasm_schema::cw_serde;
use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    pub platform_address: Addr,
    pub usdc_denom: String,
    pub entry_fee: u128,      // 8 USDC = 8_000_000
    pub referral_reward: u128, // 5 USDC = 5_000_000
    pub platform_fee: u128,    // 3 USDC = 3_000_000
    /// Optional CW-721 contract for membership NFTs (direct USDC flow)
    /// If set, mints an NFT when members join via direct USDC
    pub nft_contract: Option<Addr>,
    /// Optional CW-721 contract used by Crossmint (for Claim verification)
    /// Contract queries this to verify caller owns an NFT before processing claim
    pub crossmint_nft_contract: Option<Addr>,
}

#[cw_serde]
pub struct Member {
    pub address: Addr,
    pub referrer: Option<Addr>,
    pub joined_at: u64,
    pub referral_count: u32,
    pub total_earned: u128,
    /// How the member joined: "usdc" (direct) or "crossmint" (credit card)
    pub payment_method: Option<String>,
    /// Whether funds have been distributed for this member
    pub distributed: Option<bool>,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const MEMBERS: Map<&Addr, Member> = Map::new("members");
pub const TOTAL_MEMBERS: Item<u64> = Item::new("total_members");
pub const TOTAL_PAID_OUT: Item<u128> = Item::new("total_paid_out");
