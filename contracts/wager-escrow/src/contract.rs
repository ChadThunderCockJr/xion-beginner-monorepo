use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128,
};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, EscrowResponse, ExecuteMsg, InstantiateMsg, MigrateMsg, PendingDoubleResponse,
    QueryMsg, StatsResponse,
};
use crate::state::{
    Config, Escrow, EscrowStatus, PendingDouble, CONFIG, ESCROWS, TOTAL_GAMES_SETTLED,
    TOTAL_RAKE_COLLECTED,
};

const MAX_CUBE_VALUE: u32 = 64;

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
        ExecuteMsg::Settle { game_id, winner } => {
            execute_settle(deps, env, info, game_id, winner, 1)
        }
        ExecuteMsg::SettleWithMultiplier {
            game_id,
            winner,
            multiplier,
        } => execute_settle(deps, env, info, game_id, winner, multiplier),
        ExecuteMsg::Cancel { game_id } => execute_cancel(deps, env, info, game_id),
        ExecuteMsg::ClaimTimeout { game_id } => execute_claim_timeout(deps, env, info, game_id),
        ExecuteMsg::OfferDouble {
            game_id,
            doubler,
            new_cube_value,
        } => execute_offer_double(deps, env, info, game_id, doubler, new_cube_value),
        ExecuteMsg::DoubleDeposit { game_id } => execute_double_deposit(deps, env, info, game_id),
        ExecuteMsg::RejectDouble { game_id, rejecter } => {
            execute_reject_double(deps, env, info, game_id, rejecter)
        }
        ExecuteMsg::UpdateConfig {
            game_contract,
            rake_bps,
            rake_recipient,
            min_wager,
            max_wager,
            timeout_seconds,
        } => execute_update_config(
            deps,
            info,
            game_contract,
            rake_bps,
            rake_recipient,
            min_wager,
            max_wager,
            timeout_seconds,
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
        || config
            .game_contract
            .as_ref()
            .map_or(false, |gc| info.sender == *gc);
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
        player_a_deposited: 0,
        player_b_deposited: 0,
        status: EscrowStatus::AwaitingDeposits,
        created_at: env.block.time.seconds(),
        settled_at: None,
        cube_value: 1,
        pending_double: None,
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
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

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

    // Check not already deposited (u128 > 0 means deposited)
    if (is_player_a && escrow.player_a_deposited > 0)
        || (is_player_b && escrow.player_b_deposited > 0)
    {
        return Err(ContractError::AlreadyDeposited {});
    }

    // Validate payment amount
    let payment = info
        .funds
        .iter()
        .find(|c| c.denom == config.usdc_denom)
        .ok_or(ContractError::NoPayment {})?;

    if payment.amount.u128() != escrow.wager_amount {
        return Err(ContractError::InvalidPayment {
            expected: escrow.wager_amount,
            received: payment.amount.u128(),
            denom: config.usdc_denom.clone(),
        });
    }

    // Mark as deposited with actual amount
    if is_player_a {
        escrow.player_a_deposited = payment.amount.u128();
    } else {
        escrow.player_b_deposited = payment.amount.u128();
    }

    // If both deposited, transition to Active
    if escrow.player_a_deposited > 0 && escrow.player_b_deposited > 0 {
        escrow.status = EscrowStatus::Active;
    }

    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(Response::new()
        .add_attribute("action", "deposit")
        .add_attribute("game_id", game_id)
        .add_attribute("player", info.sender.to_string())
        .add_attribute("amount", payment.amount.to_string())
        .add_attribute("status", format!("{:?}", escrow.status)))
}

fn execute_offer_double(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    game_id: String,
    doubler: String,
    new_cube_value: u32,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can call
    let is_authorized = info.sender == config.admin
        || config
            .game_contract
            .as_ref()
            .map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

    // Must be Active
    if escrow.status != EscrowStatus::Active {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "Active".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    // Validate new cube value is exactly double current
    if new_cube_value != escrow.cube_value * 2 {
        return Err(ContractError::InvalidCubeValue {
            value: new_cube_value,
        });
    }

    // Validate cube doesn't exceed max
    if new_cube_value > MAX_CUBE_VALUE {
        return Err(ContractError::CubeValueExceedsMax {
            value: new_cube_value,
            max: MAX_CUBE_VALUE,
        });
    }

    let doubler_addr = deps.api.addr_validate(&doubler)?;

    // Doubler must be a player
    if doubler_addr != escrow.player_a && doubler_addr != escrow.player_b {
        return Err(ContractError::NotAPlayer {});
    }

    let responder = if doubler_addr == escrow.player_a {
        escrow.player_b.clone()
    } else {
        escrow.player_a.clone()
    };

    // Calculate additional deposit: old_cube_value * wager_amount per player
    let additional_deposit = escrow.cube_value as u128 * escrow.wager_amount;

    escrow.pending_double = Some(PendingDouble {
        doubler: doubler_addr.clone(),
        responder: responder.clone(),
        new_cube_value,
        additional_deposit,
        doubler_deposited: false,
        responder_deposited: false,
    });
    escrow.status = EscrowStatus::AwaitingDoubleDeposits;

    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(Response::new()
        .add_attribute("action", "offer_double")
        .add_attribute("game_id", game_id)
        .add_attribute("doubler", doubler_addr.to_string())
        .add_attribute("responder", responder.to_string())
        .add_attribute("new_cube_value", new_cube_value.to_string())
        .add_attribute("additional_deposit", additional_deposit.to_string()))
}

fn execute_double_deposit(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    game_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

    // Must be AwaitingDoubleDeposits
    if escrow.status != EscrowStatus::AwaitingDoubleDeposits {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "AwaitingDoubleDeposits".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    let pending = escrow
        .pending_double
        .as_mut()
        .ok_or(ContractError::NoPendingDouble {})?;

    // Sender must be doubler or responder
    let is_doubler = info.sender == pending.doubler;
    let is_responder = info.sender == pending.responder;
    if !is_doubler && !is_responder {
        return Err(ContractError::NotAPlayer {});
    }

    // Check not already deposited for this double
    if (is_doubler && pending.doubler_deposited) || (is_responder && pending.responder_deposited) {
        return Err(ContractError::AlreadyDepositedDouble {});
    }

    // Validate payment amount matches additional deposit
    let payment = info
        .funds
        .iter()
        .find(|c| c.denom == config.usdc_denom)
        .ok_or(ContractError::NoPayment {})?;

    if payment.amount.u128() != pending.additional_deposit {
        return Err(ContractError::InvalidPayment {
            expected: pending.additional_deposit,
            received: payment.amount.u128(),
            denom: config.usdc_denom.clone(),
        });
    }

    // Mark depositor and update cumulative deposits
    if is_doubler {
        pending.doubler_deposited = true;
        if pending.doubler == escrow.player_a {
            escrow.player_a_deposited += payment.amount.u128();
        } else {
            escrow.player_b_deposited += payment.amount.u128();
        }
    } else {
        pending.responder_deposited = true;
        if pending.responder == escrow.player_a {
            escrow.player_a_deposited += payment.amount.u128();
        } else {
            escrow.player_b_deposited += payment.amount.u128();
        }
    }

    // Check if both have deposited
    let both_deposited = pending.doubler_deposited && pending.responder_deposited;
    let new_cube = pending.new_cube_value;

    if both_deposited {
        escrow.cube_value = new_cube;
        escrow.pending_double = None;
        escrow.status = EscrowStatus::Active;
    }

    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    let mut response = Response::new()
        .add_attribute("action", "double_deposit")
        .add_attribute("game_id", game_id)
        .add_attribute("player", info.sender.to_string())
        .add_attribute("amount", payment.amount.to_string());

    if both_deposited {
        response = response
            .add_attribute("double_complete", "true")
            .add_attribute("new_cube_value", new_cube.to_string());
    }

    Ok(response)
}

fn execute_reject_double(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    rejecter: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can call
    let is_authorized = info.sender == config.admin
        || config
            .game_contract
            .as_ref()
            .map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

    // Can reject from Active (before escrow offerDouble) or AwaitingDoubleDeposits
    if escrow.status != EscrowStatus::Active
        && escrow.status != EscrowStatus::AwaitingDoubleDeposits
    {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "Active or AwaitingDoubleDeposits".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    let rejecter_addr = deps.api.addr_validate(&rejecter)?;
    if rejecter_addr != escrow.player_a && rejecter_addr != escrow.player_b {
        return Err(ContractError::NotAPlayer {});
    }

    // The doubler (opponent of rejecter) gets the pre-double pot
    let doubler_addr = if rejecter_addr == escrow.player_a {
        escrow.player_b.clone()
    } else {
        escrow.player_a.clone()
    };

    let mut response = Response::new();

    // Refund any additional deposits made during the pending double
    if let Some(ref pending) = escrow.pending_double {
        if pending.doubler_deposited {
            response = response.add_message(BankMsg::Send {
                to_address: pending.doubler.to_string(),
                amount: vec![Coin {
                    denom: config.usdc_denom.clone(),
                    amount: Uint128::from(pending.additional_deposit),
                }],
            });
            // Reverse the cumulative deposit tracking
            if pending.doubler == escrow.player_a {
                escrow.player_a_deposited -= pending.additional_deposit;
            } else {
                escrow.player_b_deposited -= pending.additional_deposit;
            }
        }
        if pending.responder_deposited {
            response = response.add_message(BankMsg::Send {
                to_address: pending.responder.to_string(),
                amount: vec![Coin {
                    denom: config.usdc_denom.clone(),
                    amount: Uint128::from(pending.additional_deposit),
                }],
            });
            if pending.responder == escrow.player_a {
                escrow.player_a_deposited -= pending.additional_deposit;
            } else {
                escrow.player_b_deposited -= pending.additional_deposit;
            }
        }
    }

    // Settle the pre-double pot to the doubler
    let total_pot = escrow.player_a_deposited + escrow.player_b_deposited;
    let rake = total_pot * config.rake_bps as u128 / 10_000;
    let payout = total_pot - rake;

    if payout > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: doubler_addr.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(payout),
            }],
        });
    }

    if rake > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: config.rake_recipient.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(rake),
            }],
        });
    }

    escrow.status = EscrowStatus::Forfeited;
    escrow.settled_at = Some(env.block.time.seconds());
    escrow.pending_double = None;
    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    // Update stats
    let total_rake = TOTAL_RAKE_COLLECTED.load(deps.storage)?;
    TOTAL_RAKE_COLLECTED.save(deps.storage, &(total_rake + rake))?;
    let total_settled = TOTAL_GAMES_SETTLED.load(deps.storage)?;
    TOTAL_GAMES_SETTLED.save(deps.storage, &(total_settled + 1))?;

    Ok(response
        .add_attribute("action", "reject_double")
        .add_attribute("game_id", game_id)
        .add_attribute("rejecter", rejecter_addr.to_string())
        .add_attribute("winner", doubler_addr.to_string())
        .add_attribute("payout", payout.to_string())
        .add_attribute("rake", rake.to_string()))
}

fn execute_settle(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    winner: String,
    _multiplier: u32, // Kept for API compatibility; payout now based on actual deposits
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or game contract can settle
    let is_authorized = info.sender == config.admin
        || config
            .game_contract
            .as_ref()
            .map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

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

    // Calculate payout from actual deposited amounts
    let total_pot = escrow.player_a_deposited + escrow.player_b_deposited;
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
    if payout > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: winner_addr.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(payout),
            }],
        });
    }

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
    let total_rake_collected = TOTAL_RAKE_COLLECTED.load(deps.storage)?;
    TOTAL_RAKE_COLLECTED.save(deps.storage, &(total_rake_collected + rake))?;
    let total_settled = TOTAL_GAMES_SETTLED.load(deps.storage)?;
    TOTAL_GAMES_SETTLED.save(deps.storage, &(total_settled + 1))?;

    Ok(response
        .add_attribute("action", "settle")
        .add_attribute("game_id", game_id)
        .add_attribute("winner", winner_addr.to_string())
        .add_attribute("payout", payout.to_string())
        .add_attribute("rake", rake.to_string())
        .add_attribute("cube_value", escrow.cube_value.to_string()))
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
        || config
            .game_contract
            .as_ref()
            .map_or(false, |gc| info.sender == *gc);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut escrow = ESCROWS
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

    // Can cancel if AwaitingDeposits, Active, or AwaitingDoubleDeposits
    if escrow.status != EscrowStatus::AwaitingDeposits
        && escrow.status != EscrowStatus::Active
        && escrow.status != EscrowStatus::AwaitingDoubleDeposits
    {
        return Err(ContractError::InvalidEscrowStatus {
            expected: "AwaitingDeposits, Active, or AwaitingDoubleDeposits".to_string(),
            got: format!("{:?}", escrow.status),
        });
    }

    let mut response = Response::new();

    // Refund each player's actual deposited amount
    if escrow.player_a_deposited > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: escrow.player_a.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(escrow.player_a_deposited),
            }],
        });
    }
    if escrow.player_b_deposited > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: escrow.player_b.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(escrow.player_b_deposited),
            }],
        });
    }

    escrow.status = EscrowStatus::Cancelled;
    escrow.settled_at = Some(env.block.time.seconds());
    escrow.pending_double = None;
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
        .ok_or(ContractError::EscrowNotFound {
            game_id: game_id.clone(),
        })?;

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

    let caller_deposited = (is_player_a && escrow.player_a_deposited > 0)
        || (is_player_b && escrow.player_b_deposited > 0);
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

    let refund_amount = if is_player_a {
        escrow.player_a_deposited
    } else {
        escrow.player_b_deposited
    };

    let mut response = Response::new();

    // Refund the depositing player's actual amount
    if refund_amount > 0 {
        response = response.add_message(BankMsg::Send {
            to_address: info.sender.to_string(),
            amount: vec![Coin {
                denom: config.usdc_denom.clone(),
                amount: Uint128::from(refund_amount),
            }],
        });
    }

    escrow.status = EscrowStatus::TimedOut;
    escrow.settled_at = Some(env.block.time.seconds());
    ESCROWS.save(deps.storage, &game_id, &escrow)?;

    Ok(response
        .add_attribute("action", "claim_timeout")
        .add_attribute("game_id", game_id)
        .add_attribute("refunded", info.sender.to_string())
        .add_attribute("refund_amount", refund_amount.to_string()))
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
        cube_value: escrow.cube_value,
        pending_double: escrow.pending_double.map(|pd| PendingDoubleResponse {
            doubler: pd.doubler,
            responder: pd.responder,
            new_cube_value: pd.new_cube_value,
            additional_deposit: pd.additional_deposit,
            doubler_deposited: pd.doubler_deposited,
            responder_deposited: pd.responder_deposited,
        }),
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
    // Migration from bool deposits to u128 deposits:
    // On-chain migration would iterate ESCROWS and convert:
    //   player_X_deposited: true  → wager_amount
    //   player_X_deposited: false → 0
    //   cube_value: 1 (default)
    //   pending_double: None
    // For fresh deploys, this is a no-op.
    Ok(Response::new().add_attribute("action", "migrate"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{
        mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage,
    };
    use cosmwasm_std::{coins, OwnedDeps};

    fn addr(name: &str) -> String {
        MockApi::default().addr_make(name).to_string()
    }

    fn setup() -> OwnedDeps<MockStorage, MockApi, MockQuerier> {
        let mut deps = mock_dependencies();
        let msg = InstantiateMsg {
            usdc_denom: "uusdc".to_string(),
            rake_bps: 500, // 5%
            rake_recipient: addr("treasury"),
            min_wager: 1_000_000,   // 1 USDC
            max_wager: 1_000_000_000, // 1000 USDC
            timeout_seconds: 300,
            game_contract: None,
        };
        let info = mock_info(&addr("admin"), &[]);
        instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        deps
    }

    fn create_and_deposit_both(deps: &mut OwnedDeps<MockStorage, MockApi, MockQuerier>) {
        let create_msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            create_msg,
        )
        .unwrap();

        // Player A deposits
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::Deposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Player B deposits
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_b"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::Deposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();
    }

    #[test]
    fn test_create_escrow() {
        let mut deps = setup();
        let msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        let info = mock_info(&addr("admin"), &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(res.attributes.len(), 3);

        // Verify escrow state
        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.cube_value, 1);
        assert_eq!(escrow.player_a_deposited, 0);
        assert_eq!(escrow.player_b_deposited, 0);
        assert!(escrow.pending_double.is_none());
    }

    #[test]
    fn test_deposit_exact_amount() {
        let mut deps = setup();
        let create_msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            create_msg,
        )
        .unwrap();

        let deposit_msg = ExecuteMsg::Deposit {
            game_id: "game1".to_string(),
        };
        let info = mock_info(&addr("player_a"), &coins(5_000_000, "uusdc"));
        let res = execute(deps.as_mut(), mock_env(), info, deposit_msg);
        assert!(res.is_ok());

        // Verify deposited amount is tracked
        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.player_a_deposited, 5_000_000);
        assert_eq!(escrow.player_b_deposited, 0);
    }

    #[test]
    fn test_deposit_wrong_amount_fails() {
        let mut deps = setup();
        let create_msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            create_msg,
        )
        .unwrap();

        let deposit_msg = ExecuteMsg::Deposit {
            game_id: "game1".to_string(),
        };
        let info = mock_info(&addr("player_a"), &coins(10_000_000, "uusdc"));
        let res = execute(deps.as_mut(), mock_env(), info, deposit_msg);
        assert!(res.is_err());
    }

    #[test]
    fn test_non_player_deposit_fails() {
        let mut deps = setup();
        let create_msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            create_msg,
        )
        .unwrap();

        let deposit_msg = ExecuteMsg::Deposit {
            game_id: "game1".to_string(),
        };
        let info = mock_info(&addr("random_person"), &coins(5_000_000, "uusdc"));
        let res = execute(deps.as_mut(), mock_env(), info, deposit_msg);
        assert!(res.is_err());
    }

    #[test]
    fn test_unauthorized_create_fails() {
        let mut deps = setup();
        let msg = ExecuteMsg::CreateEscrow {
            game_id: "game1".to_string(),
            player_a: addr("player_a"),
            player_b: addr("player_b"),
            wager_amount: 5_000_000u128,
        };
        let info = mock_info(&addr("not_admin"), &[]);
        let res = execute(deps.as_mut(), mock_env(), info, msg);
        assert!(res.is_err());
    }

    #[test]
    fn test_both_deposits_activates_escrow() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::Active);
        assert_eq!(escrow.player_a_deposited, 5_000_000);
        assert_eq!(escrow.player_b_deposited, 5_000_000);
    }

    #[test]
    fn test_offer_double() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();

        assert!(res
            .attributes
            .iter()
            .any(|a| a.key == "action" && a.value == "offer_double"));

        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::AwaitingDoubleDeposits);
        let pending = escrow.pending_double.unwrap();
        assert_eq!(pending.new_cube_value, 2);
        // additional_deposit = old_cube(1) * wager(5_000_000) = 5_000_000
        assert_eq!(pending.additional_deposit, 5_000_000);
    }

    #[test]
    fn test_offer_double_invalid_cube_value() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Try to set cube to 3 (not a valid doubling)
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 3,
            },
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_double_deposit_flow() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Offer double: cube 1 → 2
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();

        // Doubler (player_a) deposits additional 5M
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Escrow still awaiting
        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::AwaitingDoubleDeposits);
        assert_eq!(escrow.player_a_deposited, 10_000_000); // 5M + 5M

        // Responder (player_b) deposits additional 5M
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_b"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Escrow should be Active with cube = 2
        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::Active);
        assert_eq!(escrow.cube_value, 2);
        assert_eq!(escrow.player_a_deposited, 10_000_000);
        assert_eq!(escrow.player_b_deposited, 10_000_000);
        assert!(escrow.pending_double.is_none());
    }

    #[test]
    fn test_double_deposit_twice_fails() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();

        // First deposit OK
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Second deposit should fail
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_reject_double_from_active() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Reject double (before escrow offerDouble — server calls reject directly)
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::RejectDouble {
                game_id: "game1".to_string(),
                rejecter: addr("player_b"),
            },
        )
        .unwrap();

        // Player A (doubler) should get the payout
        assert!(res
            .attributes
            .iter()
            .any(|a| a.key == "winner" && a.value == addr("player_a")));

        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::Forfeited);
    }

    #[test]
    fn test_reject_double_refunds_pending_deposits() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Offer double
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();

        // Doubler deposits additional
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Responder rejects
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::RejectDouble {
                game_id: "game1".to_string(),
                rejecter: addr("player_b"),
            },
        )
        .unwrap();

        // Should have refund message for doubler's additional deposit + payout to doubler + rake
        assert!(res.messages.len() >= 2); // refund + payout (+ maybe rake)

        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.status, EscrowStatus::Forfeited);
    }

    #[test]
    fn test_settle_uses_actual_deposits() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Double to 2x (each has 10M deposited)
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_b"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Set contract balance in mock querier so settle can verify funds
        let env = mock_env();
        deps.querier
            .bank
            .update_balance(env.contract.address.to_string(), coins(20_000_000, "uusdc"));

        // Settle — pot is 20M, rake 5% = 1M, payout = 19M
        let res = execute(
            deps.as_mut(),
            env,
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::Settle {
                game_id: "game1".to_string(),
                winner: addr("player_a"),
            },
        )
        .unwrap();

        assert!(res
            .attributes
            .iter()
            .any(|a| a.key == "payout" && a.value == "19000000"));
        assert!(res
            .attributes
            .iter()
            .any(|a| a.key == "rake" && a.value == "1000000"));
        assert!(res
            .attributes
            .iter()
            .any(|a| a.key == "cube_value" && a.value == "2"));
    }

    #[test]
    fn test_cube_exceeds_max() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // We need to get cube to 64 first, then try 128
        // For simplicity, test that cube value 128 is rejected from cube_value=64
        // Manually set cube_value to 64
        let mut escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        escrow.cube_value = 64;
        ESCROWS.save(&mut deps.storage, "game1", &escrow).unwrap();

        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 128,
            },
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_progressive_doubling() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Double 1→2: additional = 1 * 5M = 5M each
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_b"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Each has 10M deposited, cube = 2

        // Double 2→4: additional = 2 * 5M = 10M each
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_b"),
                new_cube_value: 4,
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_b"), &coins(10_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(10_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Each has 20M deposited, cube = 4, total pot = 40M
        let escrow = ESCROWS.load(&deps.storage, "game1").unwrap();
        assert_eq!(escrow.cube_value, 4);
        assert_eq!(escrow.player_a_deposited, 20_000_000);
        assert_eq!(escrow.player_b_deposited, 20_000_000);
    }

    #[test]
    fn test_cancel_refunds_actual_deposits() {
        let mut deps = setup();
        create_and_deposit_both(&mut deps);

        // Double to 2x
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::OfferDouble {
                game_id: "game1".to_string(),
                doubler: addr("player_a"),
                new_cube_value: 2,
            },
        )
        .unwrap();
        execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("player_a"), &coins(5_000_000, "uusdc")),
            ExecuteMsg::DoubleDeposit {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Cancel while awaiting double deposits
        let res = execute(
            deps.as_mut(),
            mock_env(),
            mock_info(&addr("admin"), &[]),
            ExecuteMsg::Cancel {
                game_id: "game1".to_string(),
            },
        )
        .unwrap();

        // Should refund player_a's 10M (5M initial + 5M double) and player_b's 5M
        assert_eq!(res.messages.len(), 2); // Two refund messages
    }
}
