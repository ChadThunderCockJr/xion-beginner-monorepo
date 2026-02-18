use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

#[cw_serde]
pub struct InstantiateMsg {
    pub platform_address: String,
    pub usdc_denom: String,
    pub entry_fee: u128,
    pub referral_reward: u128,
    pub platform_fee: u128,
    /// Optional CW-721 contract for minting membership NFTs (direct USDC flow)
    pub nft_contract: Option<String>,
    /// Optional CW-721 contract used by Crossmint (for Claim verification)
    pub crossmint_nft_contract: Option<String>,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Join the pyramid with direct USDC payment.
    /// Send entry_fee USDC with this message.
    /// Funds are split atomically: $5 to referrer, $3 to platform.
    /// Mints membership NFT if nft_contract is configured.
    Join { referrer: Option<String> },

    /// Claim membership after paying via Crossmint.
    /// Permissionless - anyone can call for themselves.
    /// Verifies caller owns a Crossmint NFT, then distributes funds.
    /// User provides referrer (honor system - no incentive to lie).
    Claim { referrer: Option<String> },

    /// Admin only: update config
    UpdateConfig {
        platform_address: Option<String>,
        entry_fee: Option<u128>,
        referral_reward: Option<u128>,
        platform_fee: Option<u128>,
        nft_contract: Option<String>,
        crossmint_nft_contract: Option<String>,
    },
}

#[cw_serde]
pub struct MigrateMsg {}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},

    #[returns(MemberResponse)]
    Member { address: String },

    #[returns(StatsResponse)]
    Stats {},

    #[returns(ReferralsResponse)]
    Referrals { address: String },
}

#[cw_serde]
pub struct ConfigResponse {
    pub admin: Addr,
    pub platform_address: Addr,
    pub usdc_denom: String,
    pub entry_fee: u128,
    pub referral_reward: u128,
    pub platform_fee: u128,
    pub nft_contract: Option<Addr>,
    pub crossmint_nft_contract: Option<Addr>,
}

#[cw_serde]
pub struct MemberResponse {
    pub is_member: bool,
    pub member: Option<MemberInfo>,
}

#[cw_serde]
pub struct MemberInfo {
    pub address: Addr,
    pub referrer: Option<Addr>,
    pub joined_at: u64,
    pub referral_count: u32,
    pub total_earned: u128,
    pub payment_method: Option<String>,
    pub distributed: Option<bool>,
}

#[cw_serde]
pub struct StatsResponse {
    pub total_members: u64,
    pub total_paid_out: u128,
}

#[cw_serde]
pub struct ReferralsResponse {
    pub referral_count: u32,
    pub total_earned: u128,
}
