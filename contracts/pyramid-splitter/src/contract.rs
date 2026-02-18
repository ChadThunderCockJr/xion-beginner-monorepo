use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, CosmosMsg, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128, WasmMsg,
};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, InstantiateMsg, MemberInfo, MemberResponse, MigrateMsg, QueryMsg,
    ReferralsResponse, StatsResponse,
};
use crate::state::{Config, Member, CONFIG, MEMBERS, TOTAL_MEMBERS, TOTAL_PAID_OUT};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let nft_contract = msg
        .nft_contract
        .map(|addr| deps.api.addr_validate(&addr))
        .transpose()?;

    let crossmint_nft_contract = msg
        .crossmint_nft_contract
        .map(|addr| deps.api.addr_validate(&addr))
        .transpose()?;

    let config = Config {
        admin: info.sender.clone(),
        platform_address: deps.api.addr_validate(&msg.platform_address)?,
        usdc_denom: msg.usdc_denom,
        entry_fee: msg.entry_fee,
        referral_reward: msg.referral_reward,
        platform_fee: msg.platform_fee,
        nft_contract,
        crossmint_nft_contract,
    };

    CONFIG.save(deps.storage, &config)?;
    TOTAL_MEMBERS.save(deps.storage, &0)?;
    TOTAL_PAID_OUT.save(deps.storage, &0)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("admin", info.sender))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Join { referrer } => execute_join(deps, env, info, referrer),
        ExecuteMsg::Claim { referrer } => execute_claim(deps, env, info, referrer),
        ExecuteMsg::UpdateConfig {
            platform_address,
            entry_fee,
            referral_reward,
            platform_fee,
            nft_contract,
            crossmint_nft_contract,
        } => execute_update_config(
            deps,
            info,
            platform_address,
            entry_fee,
            referral_reward,
            platform_fee,
            nft_contract,
            crossmint_nft_contract,
        ),
    }
}

fn execute_join(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    referrer: Option<String>,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Check if already a member
    if MEMBERS.has(deps.storage, &info.sender) {
        return Err(ContractError::AlreadyMember {});
    }

    // Validate payment
    let payment = info
        .funds
        .iter()
        .find(|c| c.denom == config.usdc_denom)
        .ok_or(ContractError::NoPayment {})?;

    if payment.amount.u128() < config.entry_fee {
        return Err(ContractError::InvalidPayment {
            expected: config.entry_fee,
            received: payment.amount.u128(),
            denom: config.usdc_denom.clone(),
        });
    }

    // Validate referrer if provided
    let referrer_addr = if let Some(ref referrer_str) = referrer {
        let addr = deps.api.addr_validate(referrer_str)?;

        // Can't refer yourself
        if addr == info.sender {
            return Err(ContractError::SelfReferral {});
        }

        // Referrer must be a member
        if !MEMBERS.has(deps.storage, &addr) {
            return Err(ContractError::ReferrerNotFound {});
        }
        Some(addr)
    } else {
        None
    };

    // Create member record
    let member = Member {
        address: info.sender.clone(),
        referrer: referrer_addr.clone(),
        joined_at: env.block.time.seconds(),
        referral_count: 0,
        total_earned: 0,
        payment_method: Some("usdc".to_string()),
        distributed: Some(true), // Direct USDC payments are distributed atomically
    };
    MEMBERS.save(deps.storage, &info.sender, &member)?;

    // Update total members
    let total = TOTAL_MEMBERS.load(deps.storage)?;
    TOTAL_MEMBERS.save(deps.storage, &(total + 1))?;

    // Build response with payment splits
    let mut response = Response::new()
        .add_attribute("action", "join")
        .add_attribute("member", info.sender.to_string());

    let mut total_paid = 0u128;

    // Pay referrer if exists
    if let Some(ref referrer_addr) = referrer_addr {
        // Update referrer's stats
        let mut referrer_member = MEMBERS.load(deps.storage, referrer_addr)?;
        referrer_member.referral_count += 1;
        referrer_member.total_earned += config.referral_reward;
        MEMBERS.save(deps.storage, referrer_addr, &referrer_member)?;

        // Send referral reward
        response = response.add_message(BankMsg::Send {
            to_address: referrer_addr.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(config.referral_reward),
            }],
        });
        response = response.add_attribute("referrer", referrer_addr.to_string());
        response = response.add_attribute("referral_reward", config.referral_reward.to_string());

        total_paid += config.referral_reward;
    }

    // Send platform fee
    response = response.add_message(BankMsg::Send {
        to_address: config.platform_address.to_string(),
        amount: vec![Coin {
            denom: config.usdc_denom.clone(),
            amount: Uint128::from(config.platform_fee),
        }],
    });
    total_paid += config.platform_fee;

    // If no referrer, platform gets the full entry fee
    if referrer_addr.is_none() {
        let extra = config.referral_reward; // Platform gets the would-be referral too
        response = response.add_message(BankMsg::Send {
            to_address: config.platform_address.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(extra),
            }],
        });
        total_paid += extra;
    }

    // Update total paid out
    let current_paid = TOTAL_PAID_OUT.load(deps.storage)?;
    TOTAL_PAID_OUT.save(deps.storage, &(current_paid + total_paid))?;

    // Mint NFT if nft_contract is configured
    // Use the new member count (total + 1) as the token ID
    if let Some(nft_contract) = config.nft_contract {
        let new_total = TOTAL_MEMBERS.load(deps.storage)?;
        let token_id = format!("pyramid-{}", new_total);
        let mint_msg = create_cw721_mint_msg(
            &nft_contract.to_string(),
            &token_id,
            &info.sender.to_string(),
        )?;
        response = response.add_message(mint_msg);
        response = response.add_attribute("nft_minted", token_id);
    }

    Ok(response)
}

/// CW-721 Mint message structure
#[derive(serde::Serialize)]
struct Cw721MintMsg<T> {
    mint: Cw721MintPayload<T>,
}

#[derive(serde::Serialize)]
struct Cw721MintPayload<T> {
    token_id: String,
    owner: String,
    token_uri: Option<String>,
    extension: T,
}

/// Create a CW-721 mint message
fn create_cw721_mint_msg(
    nft_contract: &str,
    token_id: &str,
    owner: &str,
) -> Result<CosmosMsg, ContractError> {
    // CW-721 Mint message format (using empty extension)
    let mint_msg = Cw721MintMsg {
        mint: Cw721MintPayload {
            token_id: token_id.to_string(),
            owner: owner.to_string(),
            token_uri: None,
            extension: Empty {},
        },
    };

    Ok(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: nft_contract.to_string(),
        msg: to_json_binary(&mint_msg)?,
        funds: vec![],
    }))
}

/// Empty struct for CW-721 extension
#[derive(serde::Serialize)]
struct Empty {}

/// CW-721 query message for checking token ownership
#[derive(serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum Cw721QueryMsg {
    /// Returns all tokens owned by the given address
    Tokens {
        owner: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
}

/// Response for CW-721 Tokens query
#[derive(serde::Deserialize)]
struct TokensResponse {
    tokens: Vec<String>,
}

/// Claim membership after paying via Crossmint (permissionless).
/// Verifies caller owns a Crossmint NFT, then registers them and distributes funds.
/// User provides referrer - honor system since there's no incentive to lie.
fn execute_claim(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    referrer: Option<String>,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Must have crossmint_nft_contract configured
    let crossmint_nft = config
        .crossmint_nft_contract
        .ok_or(ContractError::NftContractNotConfigured {})?;

    // Check if already a member
    if MEMBERS.has(deps.storage, &info.sender) {
        return Err(ContractError::AlreadyMember {});
    }

    // Query CW-721 to verify caller owns at least one NFT
    let query_msg = Cw721QueryMsg::Tokens {
        owner: info.sender.to_string(),
        start_after: None,
        limit: Some(1),
    };
    let tokens_response: TokensResponse = deps.querier.query_wasm_smart(
        crossmint_nft.to_string(),
        &query_msg,
    )?;

    if tokens_response.tokens.is_empty() {
        return Err(ContractError::NoNftOwnership {});
    }

    // Validate referrer if provided
    let referrer_addr = if let Some(ref referrer_str) = referrer {
        let addr = deps.api.addr_validate(referrer_str)?;

        // Can't refer yourself
        if addr == info.sender {
            return Err(ContractError::SelfReferral {});
        }

        // Referrer must be a member
        if !MEMBERS.has(deps.storage, &addr) {
            return Err(ContractError::ReferrerNotFound {});
        }
        Some(addr)
    } else {
        None
    };

    // Check contract has enough balance for distribution
    let contract_balance = deps
        .querier
        .query_balance(&env.contract.address, &config.usdc_denom)?;

    let needed = config.entry_fee;
    if contract_balance.amount.u128() < needed {
        return Err(ContractError::InsufficientBalance {
            needed,
            available: contract_balance.amount.u128(),
        });
    }

    // Create member record (already distributed since we do it atomically)
    let member = Member {
        address: info.sender.clone(),
        referrer: referrer_addr.clone(),
        joined_at: env.block.time.seconds(),
        referral_count: 0,
        total_earned: 0,
        payment_method: Some("crossmint".to_string()),
        distributed: Some(true),
    };
    MEMBERS.save(deps.storage, &info.sender, &member)?;

    // Update total members
    let total = TOTAL_MEMBERS.load(deps.storage)?;
    TOTAL_MEMBERS.save(deps.storage, &(total + 1))?;

    // Build response with payment splits
    let mut response = Response::new()
        .add_attribute("action", "claim")
        .add_attribute("member", info.sender.to_string())
        .add_attribute("payment_method", "crossmint");

    let mut total_paid = 0u128;

    // Pay referrer if exists
    if let Some(ref referrer_addr) = referrer_addr {
        // Update referrer's stats
        let mut referrer_member = MEMBERS.load(deps.storage, referrer_addr)?;
        referrer_member.referral_count += 1;
        referrer_member.total_earned += config.referral_reward;
        MEMBERS.save(deps.storage, referrer_addr, &referrer_member)?;

        // Send referral reward
        response = response.add_message(BankMsg::Send {
            to_address: referrer_addr.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(config.referral_reward),
            }],
        });
        response = response.add_attribute("referrer", referrer_addr.to_string());
        response = response.add_attribute("referral_reward", config.referral_reward.to_string());

        total_paid += config.referral_reward;
    }

    // Send platform fee
    response = response.add_message(BankMsg::Send {
        to_address: config.platform_address.to_string(),
        amount: vec![Coin {
            denom: config.usdc_denom.clone(),
            amount: Uint128::from(config.platform_fee),
        }],
    });
    total_paid += config.platform_fee;

    // If no referrer, platform gets the full entry fee
    if referrer_addr.is_none() {
        let extra = config.referral_reward;
        response = response.add_message(BankMsg::Send {
            to_address: config.platform_address.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom,
                amount: Uint128::from(extra),
            }],
        });
        total_paid += extra;
    }

    // Update total paid out
    let current_paid = TOTAL_PAID_OUT.load(deps.storage)?;
    TOTAL_PAID_OUT.save(deps.storage, &(current_paid + total_paid))?;

    Ok(response)
}

fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    platform_address: Option<String>,
    entry_fee: Option<u128>,
    referral_reward: Option<u128>,
    platform_fee: Option<u128>,
    nft_contract: Option<String>,
    crossmint_nft_contract: Option<String>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    // Only admin can update
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(addr) = platform_address {
        config.platform_address = deps.api.addr_validate(&addr)?;
    }
    if let Some(fee) = entry_fee {
        config.entry_fee = fee;
    }
    if let Some(reward) = referral_reward {
        config.referral_reward = reward;
    }
    if let Some(fee) = platform_fee {
        config.platform_fee = fee;
    }
    if let Some(addr) = nft_contract {
        config.nft_contract = Some(deps.api.addr_validate(&addr)?);
    }
    if let Some(addr) = crossmint_nft_contract {
        config.crossmint_nft_contract = Some(deps.api.addr_validate(&addr)?);
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Member { address } => to_json_binary(&query_member(deps, address)?),
        QueryMsg::Stats {} => to_json_binary(&query_stats(deps)?),
        QueryMsg::Referrals { address } => to_json_binary(&query_referrals(deps, address)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        admin: config.admin,
        platform_address: config.platform_address,
        usdc_denom: config.usdc_denom,
        entry_fee: config.entry_fee,
        referral_reward: config.referral_reward,
        platform_fee: config.platform_fee,
        nft_contract: config.nft_contract,
        crossmint_nft_contract: config.crossmint_nft_contract,
    })
}

fn query_member(deps: Deps, address: String) -> StdResult<MemberResponse> {
    let addr = deps.api.addr_validate(&address)?;

    match MEMBERS.may_load(deps.storage, &addr)? {
        Some(member) => Ok(MemberResponse {
            is_member: true,
            member: Some(MemberInfo {
                address: member.address,
                referrer: member.referrer,
                joined_at: member.joined_at,
                referral_count: member.referral_count,
                total_earned: member.total_earned,
                payment_method: member.payment_method,
                distributed: member.distributed,
            }),
        }),
        None => Ok(MemberResponse {
            is_member: false,
            member: None,
        }),
    }
}

fn query_stats(deps: Deps) -> StdResult<StatsResponse> {
    Ok(StatsResponse {
        total_members: TOTAL_MEMBERS.load(deps.storage)?,
        total_paid_out: TOTAL_PAID_OUT.load(deps.storage)?,
    })
}

fn query_referrals(deps: Deps, address: String) -> StdResult<ReferralsResponse> {
    let addr = deps.api.addr_validate(&address)?;

    match MEMBERS.may_load(deps.storage, &addr)? {
        Some(member) => Ok(ReferralsResponse {
            referral_count: member.referral_count,
            total_earned: member.total_earned,
        }),
        None => Ok(ReferralsResponse {
            referral_count: 0,
            total_earned: 0,
        }),
    }
}

#[entry_point]
pub fn migrate(deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    // Load existing config
    let mut config = CONFIG.load(deps.storage)?;

    // Initialize new fields if they don't exist (for migration from old version)
    if config.nft_contract.is_none() {
        config.nft_contract = None;
    }
    if config.crossmint_nft_contract.is_none() {
        config.crossmint_nft_contract = None;
    }

    // Save updated config
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("action", "migrate")
        .add_attribute("version", "updated"))
}
