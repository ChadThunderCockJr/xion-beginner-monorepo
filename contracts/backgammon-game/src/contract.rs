use cosmwasm_std::{
    entry_point, to_json_binary, Addr, Binary, CosmosMsg, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, WasmMsg,
};

use crate::error::ContractError;
use crate::msg::*;
use crate::state::*;

const DEFAULT_RATING: u32 = 150_000; // 1500.00
const RATING_CHANGE: u32 = 1_000; // +/- 10.00 per game
const MIN_RATING: u32 = 100_000; // 1000.00 floor

/// Escrow contract execute messages (typed for to_json_binary)
#[derive(serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum EscrowExecuteMsg {
    CreateEscrow {
        game_id: String,
        player_a: String,
        player_b: String,
        wager_amount: u128,
    },
    Settle {
        game_id: String,
        winner: String,
    },
    SettleWithMultiplier {
        game_id: String,
        winner: String,
        multiplier: u32,
    },
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let escrow_contract = msg
        .escrow_contract
        .map(|addr| deps.api.addr_validate(&addr))
        .transpose()?;
    let server_address = msg
        .server_address
        .map(|addr| deps.api.addr_validate(&addr))
        .transpose()?;

    let config = Config {
        admin: info.sender.clone(),
        escrow_contract,
        server_address,
        usdc_denom: msg.usdc_denom,
    };

    CONFIG.save(deps.storage, &config)?;
    TOTAL_GAMES.save(deps.storage, &0u64)?;
    GAME_COUNTER.save(deps.storage, &0u64)?;

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
        ExecuteMsg::CreateGame {
            opponent,
            wager_amount,
        } => execute_create_game(deps, env, info, opponent, wager_amount),
        ExecuteMsg::StartGame { game_id } => execute_start_game(deps, info, game_id),
        ExecuteMsg::ReportResult {
            game_id,
            winner,
            result_type,
            move_count,
        } => execute_report_result(deps, env, info, game_id, winner, result_type, move_count),
        ExecuteMsg::ReportAbandonment { game_id, abandoner } => {
            execute_report_abandonment(deps, env, info, game_id, abandoner)
        }
        ExecuteMsg::UpdateConfig {
            escrow_contract,
            server_address,
        } => execute_update_config(deps, info, escrow_contract, server_address),
    }
}

fn execute_create_game(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    opponent: String,
    wager_amount: u128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let opponent_addr = deps.api.addr_validate(&opponent)?;

    if info.sender == opponent_addr {
        return Err(ContractError::SelfPlay {});
    }

    // Generate game ID
    let counter = GAME_COUNTER.load(deps.storage)?;
    let game_id = format!("game-{}", counter + 1);
    GAME_COUNTER.save(deps.storage, &(counter + 1))?;

    let game = Game {
        game_id: game_id.clone(),
        player_a: info.sender.clone(),
        player_b: opponent_addr.clone(),
        wager_amount,
        status: GameStatus::Created,
        winner: None,
        result_type: None,
        created_at: env.block.time.seconds(),
        completed_at: None,
        move_count: 0,
    };

    GAMES.save(deps.storage, &game_id, &game)?;

    let total = TOTAL_GAMES.load(deps.storage)?;
    TOTAL_GAMES.save(deps.storage, &(total + 1))?;

    // Initialize player stats if they don't exist
    ensure_player_stats(deps.storage, &info.sender)?;
    ensure_player_stats(deps.storage, &opponent_addr)?;

    let mut response = Response::new()
        .add_attribute("action", "create_game")
        .add_attribute("game_id", &game_id)
        .add_attribute("player_a", info.sender.to_string())
        .add_attribute("player_b", opponent_addr.to_string())
        .add_attribute("wager_amount", wager_amount.to_string());

    // Create escrow if escrow contract is configured
    if let Some(escrow_contract) = &config.escrow_contract {
        let escrow_msg = EscrowExecuteMsg::CreateEscrow {
            game_id: game_id.clone(),
            player_a: info.sender.to_string(),
            player_b: opponent_addr.to_string(),
            wager_amount,
        };
        response = response.add_message(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: escrow_contract.to_string(),
            msg: to_json_binary(&escrow_msg)?,
            funds: vec![],
        }));
    }

    Ok(response)
}

fn execute_start_game(
    deps: DepsMut,
    info: MessageInfo,
    game_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only admin or server can start games
    let is_authorized = info.sender == config.admin
        || config
            .server_address
            .as_ref()
            .map_or(false, |s| info.sender == *s);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut game = GAMES
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::GameNotFound {
            game_id: game_id.clone(),
        })?;

    if game.status != GameStatus::Created {
        return Err(ContractError::InvalidGameStatus {
            expected: "Created".to_string(),
            got: format!("{:?}", game.status),
        });
    }

    game.status = GameStatus::InProgress;
    GAMES.save(deps.storage, &game_id, &game)?;

    Ok(Response::new()
        .add_attribute("action", "start_game")
        .add_attribute("game_id", game_id))
}

fn execute_report_result(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    winner: String,
    result_type_str: String,
    move_count: u32,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only server or admin can report results
    let is_authorized = info.sender == config.admin
        || config
            .server_address
            .as_ref()
            .map_or(false, |s| info.sender == *s);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut game = GAMES
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::GameNotFound {
            game_id: game_id.clone(),
        })?;

    // Game must be Created or InProgress
    if game.status != GameStatus::Created && game.status != GameStatus::InProgress {
        return Err(ContractError::InvalidGameStatus {
            expected: "Created or InProgress".to_string(),
            got: format!("{:?}", game.status),
        });
    }

    let winner_addr = deps.api.addr_validate(&winner)?;
    if winner_addr != game.player_a && winner_addr != game.player_b {
        return Err(ContractError::InvalidWinner {});
    }

    let result_type = match result_type_str.as_str() {
        "normal" => ResultType::Normal,
        "gammon" => ResultType::Gammon,
        "backgammon" => ResultType::Backgammon,
        _ => {
            return Err(ContractError::InvalidResultType {
                result_type: result_type_str,
            })
        }
    };

    // Determine multiplier for wager settlement
    let multiplier = match &result_type {
        ResultType::Normal => 1u32,
        ResultType::Gammon => 2u32,
        ResultType::Backgammon => 3u32,
    };

    // Update game
    game.status = GameStatus::Completed;
    game.winner = Some(winner_addr.clone());
    game.result_type = Some(result_type);
    game.completed_at = Some(env.block.time.seconds());
    game.move_count = move_count;
    GAMES.save(deps.storage, &game_id, &game)?;

    // Determine loser
    let loser_addr = if winner_addr == game.player_a {
        game.player_b.clone()
    } else {
        game.player_a.clone()
    };

    // NOTE: Stats are saved before the escrow settlement message is dispatched.
    // This is safe because CosmWasm executes all messages atomically — if the
    // escrow settlement fails, the entire transaction (including stat updates) reverts.

    // Update winner stats
    let mut winner_stats = PLAYER_STATS.load(deps.storage, &winner_addr)?;
    winner_stats.games_played += 1;
    winner_stats.games_won += 1;
    winner_stats.rating = winner_stats.rating.saturating_add(RATING_CHANGE);
    winner_stats.total_wagered += game.wager_amount;
    winner_stats.total_won += game.wager_amount * 2; // approximate: winner gets both wagers
    PLAYER_STATS.save(deps.storage, &winner_addr, &winner_stats)?;

    // Update loser stats
    let mut loser_stats = PLAYER_STATS.load(deps.storage, &loser_addr)?;
    loser_stats.games_played += 1;
    loser_stats.rating = loser_stats
        .rating
        .saturating_sub(RATING_CHANGE)
        .max(MIN_RATING);
    loser_stats.total_wagered += game.wager_amount;
    PLAYER_STATS.save(deps.storage, &loser_addr, &loser_stats)?;

    let mut response = Response::new()
        .add_attribute("action", "report_result")
        .add_attribute("game_id", &game_id)
        .add_attribute("winner", winner_addr.to_string())
        .add_attribute(
            "result_type",
            format!("{:?}", game.result_type.as_ref().unwrap()),
        );

    // Settle escrow if configured
    if let Some(escrow_contract) = &config.escrow_contract {
        if game.wager_amount > 0 {
            let settle_msg = if multiplier > 1 {
                EscrowExecuteMsg::SettleWithMultiplier {
                    game_id: game_id.clone(),
                    winner: winner_addr.to_string(),
                    multiplier,
                }
            } else {
                EscrowExecuteMsg::Settle {
                    game_id: game_id.clone(),
                    winner: winner_addr.to_string(),
                }
            };
            response = response.add_message(CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: escrow_contract.to_string(),
                msg: to_json_binary(&settle_msg)?,
                funds: vec![],
            }));
        }
    }

    Ok(response)
}

fn execute_report_abandonment(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    game_id: String,
    abandoner: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    let is_authorized = info.sender == config.admin
        || config
            .server_address
            .as_ref()
            .map_or(false, |s| info.sender == *s);
    if !is_authorized {
        return Err(ContractError::Unauthorized {});
    }

    let mut game = GAMES
        .may_load(deps.storage, &game_id)?
        .ok_or(ContractError::GameNotFound {
            game_id: game_id.clone(),
        })?;

    if game.status != GameStatus::Created && game.status != GameStatus::InProgress {
        return Err(ContractError::InvalidGameStatus {
            expected: "Created or InProgress".to_string(),
            got: format!("{:?}", game.status),
        });
    }

    let abandoner_addr = deps.api.addr_validate(&abandoner)?;
    if abandoner_addr != game.player_a && abandoner_addr != game.player_b {
        return Err(ContractError::InvalidWinner {}); // reuse error - abandoner must be a player
    }

    // The non-abandoner wins
    let winner_addr = if abandoner_addr == game.player_a {
        game.player_b.clone()
    } else {
        game.player_a.clone()
    };

    game.status = GameStatus::Abandoned;
    game.winner = Some(winner_addr.clone());
    game.result_type = Some(ResultType::Normal);
    game.completed_at = Some(env.block.time.seconds());
    GAMES.save(deps.storage, &game_id, &game)?;

    // Update stats (abandoner loses rating)
    let mut winner_stats = PLAYER_STATS.load(deps.storage, &winner_addr)?;
    winner_stats.games_played += 1;
    winner_stats.games_won += 1;
    winner_stats.rating = winner_stats.rating.saturating_add(RATING_CHANGE);
    winner_stats.total_wagered += game.wager_amount;
    winner_stats.total_won += game.wager_amount * 2;
    PLAYER_STATS.save(deps.storage, &winner_addr, &winner_stats)?;

    let mut abandoner_stats = PLAYER_STATS.load(deps.storage, &abandoner_addr)?;
    abandoner_stats.games_played += 1;
    abandoner_stats.rating = abandoner_stats
        .rating
        .saturating_sub(RATING_CHANGE)
        .max(MIN_RATING);
    abandoner_stats.total_wagered += game.wager_amount;
    PLAYER_STATS.save(deps.storage, &abandoner_addr, &abandoner_stats)?;

    let mut response = Response::new()
        .add_attribute("action", "report_abandonment")
        .add_attribute("game_id", &game_id)
        .add_attribute("abandoner", abandoner_addr.to_string())
        .add_attribute("winner", winner_addr.to_string());

    // Settle escrow - winner gets the pot
    if let Some(escrow_contract) = &config.escrow_contract {
        if game.wager_amount > 0 {
            let settle_msg = EscrowExecuteMsg::Settle {
                game_id: game_id.clone(),
                winner: winner_addr.to_string(),
            };
            response = response.add_message(CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: escrow_contract.to_string(),
                msg: to_json_binary(&settle_msg)?,
                funds: vec![],
            }));
        }
    }

    Ok(response)
}

fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    escrow_contract: Option<String>,
    server_address: Option<String>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(addr) = escrow_contract {
        config.escrow_contract = Some(deps.api.addr_validate(&addr)?);
    }
    if let Some(addr) = server_address {
        config.server_address = Some(deps.api.addr_validate(&addr)?);
    }

    CONFIG.save(deps.storage, &config)?;
    Ok(Response::new().add_attribute("action", "update_config"))
}

/// Ensure player stats exist (initialize if new player)
fn ensure_player_stats(
    storage: &mut dyn cosmwasm_std::Storage,
    addr: &Addr,
) -> Result<(), ContractError> {
    if !PLAYER_STATS.has(storage, addr) {
        PLAYER_STATS.save(
            storage,
            addr,
            &PlayerStats {
                address: addr.clone(),
                games_played: 0,
                games_won: 0,
                rating: DEFAULT_RATING,
                total_wagered: 0,
                total_won: 0,
            },
        )?;
    }
    Ok(())
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Game { game_id } => to_json_binary(&query_game(deps, game_id)?),
        QueryMsg::PlayerStats { address } => to_json_binary(&query_player_stats(deps, address)?),
        QueryMsg::Stats {} => to_json_binary(&query_stats(deps)?),
        QueryMsg::PlayerGames {
            address,
            start_after,
            limit,
        } => to_json_binary(&query_player_games(deps, address, start_after, limit)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        admin: config.admin,
        escrow_contract: config.escrow_contract,
        server_address: config.server_address,
        usdc_denom: config.usdc_denom,
    })
}

fn query_game(deps: Deps, game_id: String) -> StdResult<GameResponse> {
    let game = GAMES.load(deps.storage, &game_id)?;
    Ok(GameResponse {
        game_id: game.game_id,
        player_a: game.player_a,
        player_b: game.player_b,
        wager_amount: game.wager_amount,
        status: format!("{:?}", game.status),
        winner: game.winner,
        result_type: game.result_type.map(|rt| format!("{:?}", rt)),
        created_at: game.created_at,
        completed_at: game.completed_at,
        move_count: game.move_count,
    })
}

fn query_player_stats(deps: Deps, address: String) -> StdResult<PlayerStatsResponse> {
    let addr = deps.api.addr_validate(&address)?;
    match PLAYER_STATS.may_load(deps.storage, &addr)? {
        Some(stats) => Ok(PlayerStatsResponse {
            address: stats.address,
            games_played: stats.games_played,
            games_won: stats.games_won,
            rating: stats.rating,
            total_wagered: stats.total_wagered,
            total_won: stats.total_won,
        }),
        None => Ok(PlayerStatsResponse {
            address: addr,
            games_played: 0,
            games_won: 0,
            rating: DEFAULT_RATING,
            total_wagered: 0,
            total_won: 0,
        }),
    }
}

fn query_stats(deps: Deps) -> StdResult<StatsResponse> {
    Ok(StatsResponse {
        total_games: TOTAL_GAMES.load(deps.storage)?,
    })
}

// TODO: Add secondary index (e.g., Map<(Addr, u64), String>) for O(1) player game lookup
// Current implementation is O(n) and will degrade with many games
fn query_player_games(
    deps: Deps,
    address: String,
    _start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<GamesListResponse> {
    let addr = deps.api.addr_validate(&address)?;
    let limit = limit.unwrap_or(10).min(30) as usize;

    // Note: This is a simple scan. For production, we'd want a secondary index.
    let games: Vec<GameResponse> = GAMES
        .range(deps.storage, None, None, cosmwasm_std::Order::Descending)
        .filter_map(|item| {
            let (_, game) = item.ok()?;
            if game.player_a == addr || game.player_b == addr {
                Some(GameResponse {
                    game_id: game.game_id,
                    player_a: game.player_a,
                    player_b: game.player_b,
                    wager_amount: game.wager_amount,
                    status: format!("{:?}", game.status),
                    winner: game.winner,
                    result_type: game.result_type.map(|rt| format!("{:?}", rt)),
                    created_at: game.created_at,
                    completed_at: game.completed_at,
                    move_count: game.move_count,
                })
            } else {
                None
            }
        })
        .take(limit)
        .collect();

    Ok(GamesListResponse { games })
}

#[entry_point]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    Ok(Response::new().add_attribute("action", "migrate"))
}
