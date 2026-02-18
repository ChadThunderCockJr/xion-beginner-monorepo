use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128,
};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, EscrowResponse, ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg,
    StatsResponse,
};
use crate::state::{Config, Escrow, EscrowStatus, CONFIG, ESCROWS, TOTAL_GAMES_SETTLED, TOTAL_RAKE_COLLECTED};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let game_contract = msg
        .game_contract
        .map(|addr| deps.api.addr_validate(&addr))
        .transpose()?;

    let config = Config {
        admin: info.sender.clone(),
        game_contract,
        usdc_denom: msg.usdc_denom,
        rake_bps: msg.rake_bps,
        rake_recipient: deps.api.addr_validate(&msg.rake_recipient)?,
        min_wager: msg.min_wager,
        max_wager: msg.max_wager,
        timeout_seconds: msg.timeout_seconds,
    };

    CONFIG.save(deps.storage, &config)?;
    TOTAL_RAKE_COLLECTED.save(deps.storage, &0u128)?;
    TOTAL_GAMES_SETTLED.save(deps.storage, &0u64)?;

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
        ExecuteMsg::CreateEscrow {
            game_id,
            player_a,
            player_b,
            wager_amount,
        } => execute_create_escrow(deps, env, info, game_id, player_a, player_b, wager_amount),
        ExecuteMsg::Deposit { game_id } => execute_deposit(deps, env, info, game_id),
        ExecuteMsg::Settle { game_id, winner } => execute_settle(deps, env, info, game_id, winner, 1),
        ExecuteMsg::SettleWithMultiplier {
            game_id,
            winner,
            multiplier,
        } => execute_settle(deps, env, info, game_id, winner, multiplier),
        ExecuteMsg::Cancel { game_id } => execute_cancel(deps, env, info, game_id),
        ExecuteMsg::ClaimTimeout { game_id } => execute_claim_timeout(deps, env, info, game_id),
        ExecuteMsg::UpdateConfig {
            game_contract,
            rake_bps,
            rake_recipient,
            min_wager,
            max_wager,
            timeout_seconds,
        } => execute_update_config(
            deps, info, game_contract, rake_bps, rake_recipient, min_wager, max_wager, timeout_seconds,
        ),
    }
}

fn execute_create_escrow(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    player_a: String,
    player_b: String,
    wager_amount: u128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can create escrows
    let is_authorized = info.sender == config.admin
        || config.game_contract.as_ref().map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    // Check escrow doesn't already exist
    if ESCROWS.has(deps.storage, &game_id) {
        return Err(ContractError::EscrowAlreadyExists { game_id });
    }

    // Validate wager amount
    if wager_amount < config.min_wager || wager_amount > config.max_wager {
        return Err(ContractError::InvalidWager {
            amount: wager_amount,
            min: config.min_wager,
            max: config.max_wager,
        });
    }

    let player_a_addr = deps.api.addr_validate(&player_a)?;
    let player_b_addr = deps.api.addr_validate(&player_b)?;

    let escrow = Escrow {
        game_id: game_id.clone(),
        player_a: player_a_addr,
        player_b: player_b_addr,
        wager_amount,
        player_a_deposited: false,
        player_b_deposited: false,
        status: EscrowStatus::AwaitingDeposits,
        created_at: env.block.time.seconds(),
        settled_at: None,
    };

    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(Response::new()
        .add_attribute("action", "create_escrow")
        .add_attribute("game_id", game_id)
        .add_attribute("wager_amount", wager_amount.to_string()))
}

fn execute_deposit(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    game_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound { game_id: game_id.clone() })?;

    // Must be in AwaitingDeposits status
    if escrow.status != EscrowStatus::AwaitingDeposits {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "AwaitingDeposits".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    // Validate sender is a player
    let is_player_a = info.sender == escrow.player_a;
    let is_player_b = info.sender == escrow.player_b;
    if !is_player_a && !is_player_b {
        return Err(ContractError::NotAPlayer {});
    }

    // Check not already deposited
    if (is_player_a && escrow.player_a_deposited) || (is_player_b && escrow.player_b_deposited) {
        return Err(ContractError::AlreadyDeposited {});
    }

    // Validate payment amount
    let payment = info
        .funds
        .iter()
        .find(|c| c.denom == config.usdc_denom)
        .ok_or(ContractError::NoPayment {})?;

    if payment.amount.u128() < escrow.wager_amount {
        return Err(ContractError::InvalidPayment {
            expected: escrow.wager_amount,
            received: payment.amount.u128(),
            denom: config.usdc_denom.clone(),
        });
    }

    // Mark as deposited
    if is_player_a {
        escrow.player_a_deposited = true;
    } else {
        escrow.player_b_deposited = true;
    }

    // If both deposited, transition to Active
    if escrow.player_a_deposited && escrow.player_b_deposited {
        escrow.status = EscrowStatus::Active;
    }

    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(Response::new()
        .add_attribute("action", "deposit")
        .add_attribute("game_id", game_id)
        .add_attribute("player", info.sender.to_string())
        .add_attribute("status", format!("{:?}", escrow.status)))
}

fn execute_settle(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    winner: String,
    _multiplier: u32,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can settle
    let is_authorized = info.sender == config.admin
        || config.game_contract.as_ref().map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound { game_id: game_id.clone() })?;

    // Must be Active
    if escrow.status != EscrowStatus::Active {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "Active".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    // Winner must be one of the players
    let winner_addr = deps.api.addr_validate(&winner)?;
    if winner_addr != escrow.player_a && winner_addr != escrow.player_b {
        return Err(ContractError::InvalidWinner {});
    }

    // Calculate payout
    let total_pot = escrow.wager_amount * 2;
    let rake = total_pot * config.rake_bps as u128 / 10_000;
    let payout = total_pot - rake;

    // Verify contract has sufficient balance
    let balance = deps
        .querier
        .query_balance(&env.contract.address, &config.usdc_denom)?;
    if balance.amount.u128() < total_pot {
        return Err(ContractError::InsufficientBalance {
            needed: total_pot,
            available: balance.amount.u128(),
        });
    }

    let mut response = Response::new();

    // Pay winner
    response = response.add_message(BankMsg::Send {
        to_address: winner_addr.to_string(),
        amount: vec![Coin {
            denom: config.usdc_denom.clone(),
            amount: Uint128::from(payout),
        }],
    });

    // Pay rake to platform
    if rake > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: config.rake_recipient.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(rake),
            }],
        });
    }

    // Update escrow status
    escrow.status = EscrowStatus::Settled;
    escrow.settled_at = Some(env.block.time.seconds());
    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    // Update stats
    let total_rake = TOTAL_RAKE_COLLECTED.load(deps.storage)?;
    TOTAL_RAKE_COLLECTED.save(deps.storage, &(total_rake + rake))?;
    let total_settled = TOTAL_GAMES_SETTLED.load(deps.storage)?;
    TOTAL_GAMES_SETTLED.save(deps.storage, &(total_settled + 1))?;

    Ok(response
        .add_attribute("action", "settle")
        .add_attribute("game_id", game_id)
        .add_attribute("winner", winner_addr.to_string())
        .add_attribute("payout", payout.to_string())
        .add_attribute("rake", rake.to_string()))
}

fn execute_cancel(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can cancel
    let is_authorized = info.sender == config.admin
        || config.game_contract.as_ref().map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound { game_id: game_id.clone() })?;

    // Can only cancel if AwaitingDeposits or Active
    if escrow.status != EscrowStatus::AwaitingDeposits && escrow.status != EscrowStatus::Active {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "AwaitingDeposits or Active".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    let mut response = Response::new();

    // Refund deposited amounts
    if escrow.player_a_deposited {
        response = response.add_message(BankMsg::Send {
            to_address: escrow.player_a.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(escrow.wager_amount),
            }],
        });
    }
    if escrow.player_b_deposited {
        response = response.add_message(BankMsg::Send {
            to_address: escrow.player_b.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(escrow.wager_amount),
            }],
        });
    }

    escrow.status = EscrowStatus::Cancelled;
    escrow.settled_at = Some(env.block.time.seconds());
    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(response
        .add_attribute("action", "cancel")
        .add_attribute("game_id", game_id))
}

fn execute_claim_timeout(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound { game_id: game_id.clone() })?;

    // Must be in AwaitingDeposits
    if escrow.status != EscrowStatus::AwaitingDeposits {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "AwaitingDeposits".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    // Caller must be a player who has deposited
    let is_player_a = info.sender == escrow.player_a;
    let is_player_b = info.sender == escrow.player_b;
    if !is_player_a && !is_player_b {
        return Err(ContractError::NotAPlayer {});
    }

    let caller_deposited = (is_player_a && escrow.player_a_deposited)
        || (is_player_b && escrow.player_b_deposited);
    if !caller_deposited {
        return Err(ContractError::Unauthorized {});
    }

    // Check timeout has passed
    let elapsed = env.block.time.seconds() - escrow.created_at;
    if elapsed < config.timeout_seconds {
        return Err(ContractError::TimeoutNotReached {
            remaining: config.timeout_seconds - elapsed,
        });
    }

    let mut response = Response::new();

    // Refund the depositing player
    response = response.add_message(BankMsg::Send {
        to_address: info.sender.to_string(),
        amount: vec![Coin {
            denom: config.usdc_denom.clone(),
            amount: Uint128::from(escrow.wager_amount),
        }],
    });

    escrow.status = EscrowStatus::TimedOut;
    escrow.settled_at = Some(env.block.time.seconds());
    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(response
        .add_attribute("action", "claim_timeout")
        .add_attribute("game_id", game_id)
        .add_attribute("refunded", info.sender.to_string()))
}

fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    game_contract: Option<String>,
    rake_bps: Option<u16>,
    rake_recipient: Option<String>,
    min_wager: Option<u128>,
    max_wager: Option<u128>,
    timeout_seconds: Option<u64>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(addr) = game_contract {
        config.game_contract = Some(deps.api.addr_validate(&addr)?);
    }
    if let Some(bps) = rake_bps {
        config.rake_bps = bps;
    }
    if let Some(addr) = rake_recipient {
        config.rake_recipient = deps.api.addr_validate(&addr)?;
    }
    if let Some(min) = min_wager {
        config.min_wager = min;
    }
    if let Some(max) = max_wager {
        config.max_wager = max;
    }
    if let Some(timeout) = timeout_seconds {
        config.timeout_seconds = timeout;
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Escrow { game_id } => to_json_binary(&query_escrow(deps, game_id)?),
        QueryMsg::Stats {} => to_json_binary(&query_stats(deps)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        admin: config.admin,
        game_contract: config.game_contract,
        usdc_denom: config.usdc_denom,
        rake_bps: config.rake_bps,
        rake_recipient: config.rake_recipient,
        min_wager: config.min_wager,
        max_wager: config.max_wager,
        timeout_seconds: config.timeout_seconds,
    })
}

fn query_escrow(deps: Deps, game_id: String) -> StdResult<EscrowResponse> {
    let escrow = ESCROWS.load(deps.storage, &game_id)?;
    Ok(EscrowResponse {
        game_id: escrow.game_id,
        player_a: escrow.player_a,
        player_b: escrow.player_b,
        wager_amount: escrow.wager_amount,
        player_a_deposited: escrow.player_a_deposited,
        player_b_deposited: escrow.player_b_deposited,
        status: format!("{:?}", escrow.status),
        created_at: escrow.created_at,
        settled_at: escrow.settled_at,
    })
}

fn query_stats(deps: Deps) -> StdResult<StatsResponse> {
    Ok(StatsResponse {
        total_rake_collected: TOTAL_RAKE_COLLECTED.load(deps.storage)?,
        total_games_settled: TOTAL_GAMES_SETTLED.load(deps.storage)?,
    })
}

#[entry_point]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    Ok(Response::new().add_attribute("action", "migrate"))
}
