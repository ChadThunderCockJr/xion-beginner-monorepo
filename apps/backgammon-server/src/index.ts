import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { GameManager } from "./game-manager.js";
import { Matchmaker } from "./matchmaking.js";
import { SocialManager } from "./social-manager.js";
import { getRedis } from "./redis.js";
import * as socialStore from "./social-store.js";
import type { ClientMessage, PlayerConnection, ServerMessage } from "./types.js";
import { logger } from "./logger.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

const wsRateLimits = new Map<WebSocket, { count: number; resetAt: number }>();

function checkRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  let entry = wsRateLimits.get(ws);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    wsRateLimits.set(ws, entry);
  }
  entry.count++;
  if (entry.count > 30) {
    send(ws, { type: "error", message: "Rate limit exceeded" });
    ws.close(1008, "Rate limit exceeded");
    return false;
  }
  return true;
}

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  methods: ["GET"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

// Helper: resolve address to display name
async function getDisplayName(address: string): Promise<string> {
  try {
    const profile = await socialStore.getProfile(address);
    return profile?.displayName || profile?.username || address;
  } catch {
    return address;
  }
}

// Health check
app.get("/health", async (_req, res) => {
  const health: Record<string, unknown> = { status: "ok", uptime: process.uptime() };
  try {
    const { getRedis: getR } = await import("./redis.js");
    const r = getR();
    if (r) {
      await r.ping();
      health.redis = "ok";
    } else {
      health.redis = "unavailable";
    }
  } catch {
    health.redis = "error";
    health.status = "degraded";
  }
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

// Profile REST endpoint
app.get("/api/profile/:address", async (req, res) => {
  const profile = await socialStore.getProfile(req.params.address);
  if (!profile) {
    res.json({ address: req.params.address, displayName: "", createdAt: 0 });
  } else {
    res.json({ address: req.params.address, ...profile });
  }
});

// Match history REST endpoints
app.get("/api/matches/:address", async (req, res) => {
  const matches = await socialStore.getMatchResults(req.params.address);
  res.json({ matches });
});

// Stats + rating merged
app.get("/api/stats/:address", async (req, res) => {
  const [stats, rating] = await Promise.all([
    socialStore.getStats(req.params.address),
    socialStore.getRating(req.params.address),
  ]);
  res.json({ ...stats, ...rating });
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await socialStore.getLeaderboard(limit, offset);
  res.json(result);
});

// Player rank
app.get("/api/rank/:address", async (req, res) => {
  const rank = await socialStore.getPlayerRank(req.params.address);
  res.json({ rank });
});

// Friends leaderboard
app.get("/api/leaderboard/friends/:address", async (req, res) => {
  const entries = await socialStore.getFriendsLeaderboard(req.params.address);
  res.json({ entries });
});

// Online count
app.get("/api/online-count", async (_req, res) => {
  const count = await socialStore.getOnlineCount();
  res.json({ count });
});

app.get("/api/game/:gameId/history", async (req, res) => {
  const moveHistory = await socialStore.getGameHistory(req.params.gameId);
  if (!moveHistory) {
    res.status(404).json({ error: "Game history not found" });
  } else {
    res.json({ gameId: req.params.gameId, moveHistory });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 }); // 16KB max

// Initialize Redis
getRedis();

const gameManager = new GameManager();
const matchmaker = new Matchmaker(gameManager);

// Track authenticated connections
const connections = new Map<WebSocket, { address: string; rating: number }>();

const socialManager = new SocialManager(connections, gameManager);

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on("connection", async (ws: WebSocket) => {
  logger.info("WebSocket connected");

  // Send auth challenge nonce
  const { generateNonce } = await import("./auth.js");
  const nonce = generateNonce();
  send(ws, { type: "auth_challenge" as const, nonce });

  ws.on("message", (data: Buffer) => {
    if (!checkRateLimit(ws)) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      logger.warn("Invalid JSON received from client");
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    handleMessage(ws, msg);
  });

  ws.on("close", () => {
    wsRateLimits.delete(ws);
    const conn = connections.get(ws);
    if (conn) {
      // Handle disconnect from active game — start grace period
      const result = gameManager.handleDisconnect(conn.address);
      if (result) {
        const { game } = result;
        if (game.status === "playing" && !game.gameState.gameOver) {
          gameManager.startDisconnectGracePeriod(game, conn.address);
        }
      }

      // Remove from matchmaking
      matchmaker.removeFromQueue(conn.address);

      // Social: mark offline, notify friends
      socialStore.markOffline(conn.address);
      socialManager.broadcastPresence(conn.address, "offline");

      connections.delete(ws);
    }
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
  // Refresh online heartbeat for every message from an authenticated connection
  const authedConn = connections.get(ws);
  if (authedConn) {
    socialStore.refreshOnlineHeartbeat(authedConn.address);
  }

  switch (msg.type) {
    case "auth": {
      // Enforce 1 connection per address
      for (const [existingWs, existingConn] of connections) {
        if (existingConn.address === msg.address && existingWs !== ws) {
          send(existingWs, { type: "error", message: "Authenticated from another session" });
          existingWs.close(1000, "Replaced by new connection");
          connections.delete(existingWs);
        }
      }

      // Verify wallet signature (skip in dev mode)
      const { verifySignature, isAuthSkipped } = await import("./auth.js");
      if (!isAuthSkipped()) {
        if (!msg.signature || !msg.pubkey || !msg.nonce) {
          send(ws, { type: "error", message: "Missing signature, pubkey, or nonce" });
          return;
        }
        const valid = await verifySignature(msg.address, msg.nonce, msg.signature, msg.pubkey);
        if (!valid) {
          send(ws, { type: "error", message: "Invalid signature" });
          ws.close(1008, "Authentication failed");
          return;
        }
      }

      const ratingInfo = await socialStore.getRating(msg.address);
      connections.set(ws, { address: msg.address, rating: ratingInfo.rating });
      logger.info("Player authenticated", { address: msg.address });
      send(ws, { type: "auth_ok", address: msg.address });

      // Social: ensure profile, send it, mark online, notify friends
      socialStore.ensureProfile(msg.address).then(() => {
        socialManager.sendProfile(ws, msg.address);
      });
      socialStore.markOnline(msg.address);
      socialManager.broadcastPresence(msg.address, "online");

      // Check for reconnection to existing game
      const existingGameId = gameManager.getPlayerGame(msg.address);
      if (existingGameId) {
        const game = gameManager.getGame(existingGameId);
        if (game && game.status === "playing") {
          const color = gameManager.getPlayerColor(game, msg.address);
          if (color) {
            const player: PlayerConnection = {
              ws,
              address: msg.address,
              rating: ratingInfo.rating,
              connectedAt: Date.now(),
            };
            gameManager.handleReconnect(existingGameId, player);

            // Cancel disconnect grace period if active
            if (game.disconnectedPlayer === msg.address) {
              gameManager.cancelDisconnectGracePeriod(game);
            }

            // Notify opponent
            const opponent = color === "white" ? game.playerBlack : game.playerWhite;
            if (opponent) {
              gameManager.sendToPlayer(opponent, {
                type: "opponent_reconnected",
                game_id: existingGameId,
              });
            }

            // Send current game state (with display names)
            const [wName, bName] = await Promise.all([
              getDisplayName(game.playerWhite?.address || ""),
              getDisplayName(game.playerBlack?.address || ""),
            ]);
            send(ws, {
              type: "game_start",
              game_id: existingGameId,
              white: game.playerWhite?.address || "",
              black: game.playerBlack?.address || "",
              white_name: wName,
              black_name: bName,
              game_state: game.gameState,
            });
          }
        }
      }
      break;
    }

    case "create_game": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const game = gameManager.createGame(msg.wager_amount);
      const player: PlayerConnection = {
        ws,
        address: conn.address,
        rating: conn.rating,
        connectedAt: Date.now(),
      };
      const result = gameManager.joinGame(game.id, player);
      if (result) {
        logger.info("Game created", { gameId: game.id, address: conn.address });
        send(ws, { type: "game_created", game_id: game.id, color: result.color });
      }
      break;
    }

    case "join_game": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const game = gameManager.getGame(msg.game_id);
      if (!game) { send(ws, { type: "error", message: "Game not found", code: "GAME_NOT_FOUND" }); return; }

      const player: PlayerConnection = {
        ws,
        address: conn.address,
        rating: conn.rating,
        connectedAt: Date.now(),
      };
      const result = gameManager.joinGame(msg.game_id, player);
      if (!result) { send(ws, { type: "error", message: "Cannot join game", code: "CANNOT_JOIN" }); return; }

      // Notify joiner
      const opponentConn = result.color === "white" ? game.playerBlack : game.playerWhite;
      const opponentAddr = opponentConn?.address || game.playerWhite?.address || "";
      const opponentName = await getDisplayName(opponentAddr);
      send(ws, {
        type: "game_joined",
        game_id: msg.game_id,
        color: result.color,
        opponent: opponentAddr,
        opponent_name: opponentName,
      });

      // Notify both players game is starting
      if (game.playerWhite && game.playerBlack) {
        const [wN, bN] = await Promise.all([
          getDisplayName(game.playerWhite.address),
          getDisplayName(game.playerBlack.address),
        ]);
        const startMsg: ServerMessage = {
          type: "game_start",
          game_id: game.id,
          white: game.playerWhite.address,
          black: game.playerBlack.address,
          white_name: wN,
          black_name: bN,
          game_state: game.gameState,
        };
        gameManager.broadcastToGame(game, startMsg);
      }
      break;
    }

    case "join_queue": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = matchmaker.addToQueue({
        address: conn.address,
        ws,
        rating: conn.rating,
        wagerAmount: msg.wager_amount,
        joinedAt: Date.now(),
      });

      if (result.matched && result.gameId) {
        const game = gameManager.getGame(result.gameId)!;
        const [wN, bN] = await Promise.all([
          getDisplayName(game.playerWhite!.address),
          getDisplayName(game.playerBlack!.address),
        ]);
        const startMsg: ServerMessage = {
          type: "game_start",
          game_id: result.gameId,
          white: game.playerWhite!.address,
          black: game.playerBlack!.address,
          white_name: wN,
          black_name: bN,
          game_state: game.gameState,
        };
        gameManager.broadcastToGame(game, startMsg);
      } else {
        send(ws, { type: "queue_joined", position: matchmaker.getQueuePosition(conn.address) });
      }
      break;
    }

    case "leave_queue": {
      const conn = connections.get(ws);
      if (!conn) return;
      matchmaker.removeFromQueue(conn.address);
      send(ws, { type: "queue_left" });
      break;
    }

    case "roll_dice": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = await gameManager.rollDiceLocked(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot roll dice", code: "CANNOT_ROLL" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      const playerColor = gameManager.getPlayerColor(game, conn.address)!;

      // Always send dice roll — never auto-end. Player must confirm.
      {
        const currentPlayer = playerColor === "white" ? game.playerWhite : game.playerBlack;
        const opponentPlayer = playerColor === "white" ? game.playerBlack : game.playerWhite;

        gameManager.sendToPlayer(currentPlayer, {
          type: "dice_rolled",
          game_id: msg.game_id,
          dice: result.dice,
          player: playerColor,
          game_state: result.gameState,
          legal_moves: result.legalMoves,
          needs_confirmation: result.legalMoves.length === 0,
        });
        gameManager.sendToPlayer(opponentPlayer, {
          type: "dice_rolled",
          game_id: msg.game_id,
          dice: result.dice,
          player: playerColor,
          game_state: result.gameState,
          legal_moves: [],
        });
        for (const spec of game.spectators) {
          gameManager.sendToPlayer(spec, {
            type: "dice_rolled",
            game_id: msg.game_id,
            dice: result.dice,
            player: playerColor,
            game_state: result.gameState,
            legal_moves: [],
          });
        }
      }
      break;
    }

    case "move": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const from = Number(msg.from);
      const to = Number(msg.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 25 || to < 0 || to > 25) {
        send(ws, { type: "error", message: "Invalid move coordinates" });
        return;
      }

      const result = await gameManager.applyMoveLocked(msg.game_id, conn.address, from, to);
      if (!result) { send(ws, { type: "error", message: "Invalid move", code: "INVALID_MOVE" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      const playerColor = gameManager.getPlayerColor(game, conn.address)!;

      if (result.turnAutoEnded) {
        // Send move_made with needs_confirmation to the moving player
        const currentPlayer = playerColor === "white" ? game.playerWhite : game.playerBlack;
        const opponentPlayer = playerColor === "white" ? game.playerBlack : game.playerWhite;

        gameManager.sendToPlayer(currentPlayer, {
          type: "move_made",
          game_id: msg.game_id,
          move: result.move,
          player: result.playerColor,
          game_state: result.gameState,
          legal_moves: [],
          needs_confirmation: true,
        });
        gameManager.sendToPlayer(opponentPlayer, {
          type: "move_made",
          game_id: msg.game_id,
          move: result.move,
          player: result.playerColor,
          game_state: result.gameState,
          legal_moves: [],
        });
        for (const spec of game.spectators) {
          gameManager.sendToPlayer(spec, {
            type: "move_made",
            game_id: msg.game_id,
            move: result.move,
            player: result.playerColor,
            game_state: result.gameState,
            legal_moves: [],
          });
        }
        // DON'T broadcast turn_ended — wait for explicit end_turn
      } else {
        gameManager.broadcastToGame(game, {
          type: "move_made",
          game_id: msg.game_id,
          move: result.move,
          player: result.playerColor,
          game_state: result.gameState,
          legal_moves: result.legalMoves,
        });
      }

      // Check if game is over
      if (result.gameState.gameOver) {
        logger.info("Game over", { gameId: msg.game_id, winner: result.gameState.winner!, resultType: result.gameState.resultType! });
        gameManager.broadcastToGame(game, {
          type: "game_over",
          game_id: msg.game_id,
          winner: result.gameState.winner!,
          result_type: result.gameState.resultType!,
          game_state: result.gameState,
        });
        socialManager.recordMatchResult(game, result.gameState.winner!, result.gameState.resultType!);
        socialStore.saveGameHistory(game.id, game.gameState.moveHistory);
      }
      break;
    }

    case "end_turn": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = await gameManager.handleEndTurnLocked(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot end turn", code: "CANNOT_END_TURN" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "turn_ended",
        game_id: msg.game_id,
        next_player: result.currentPlayer,
        game_state: result,
      });
      break;
    }

    case "undo_move": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = await gameManager.handleUndoLocked(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot undo", code: "CANNOT_UNDO" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "move_undone",
        game_id: msg.game_id,
        game_state: result.gameState,
        legal_moves: result.legalMoves,
      });
      break;
    }

    case "resign": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const resignType = msg.resign_type || "normal";
      const result = gameManager.handleResignationTyped(msg.game_id, conn.address, resignType);
      if (!result) { send(ws, { type: "error", message: "Cannot resign", code: "CANNOT_RESIGN" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      if (result.offered) {
        // Gammon/backgammon resignation offered — opponent must accept/reject
        const playerColor = gameManager.getPlayerColor(game, conn.address)!;
        gameManager.broadcastToGame(game, {
          type: "resign_offered",
          game_id: msg.game_id,
          player: playerColor,
          resign_type: resignType,
        });
      } else {
        // Normal resignation — immediate game over
        logger.info("Game over", { gameId: msg.game_id, winner: result.winner!, reason: "resignation" });
        gameManager.broadcastToGame(game, {
          type: "game_over",
          game_id: msg.game_id,
          winner: result.winner!,
          result_type: "normal",
          game_state: game.gameState,
        });
        socialManager.recordMatchResult(game, result.winner!, "normal");
        socialStore.saveGameHistory(game.id, game.gameState.moveHistory);
      }
      break;
    }

    case "accept_resign": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = gameManager.handleAcceptResignation(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot accept resignation" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      logger.info("Game over", { gameId: msg.game_id, winner: result.winner, reason: "resignation accepted" });
      gameManager.broadcastToGame(game, {
        type: "game_over",
        game_id: msg.game_id,
        winner: result.winner,
        result_type: result.resultType,
        game_state: game.gameState,
      });
      socialManager.recordMatchResult(game, result.winner, result.resultType);
      socialStore.saveGameHistory(game.id, game.gameState.moveHistory);
      break;
    }

    case "reject_resign": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const rejected = gameManager.handleRejectResignation(msg.game_id, conn.address);
      if (!rejected) { send(ws, { type: "error", message: "Cannot reject resignation" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, { type: "resign_rejected", game_id: msg.game_id });
      break;
    }

    case "offer_double": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = gameManager.handleOfferDouble(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot double", code: "CANNOT_DOUBLE" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "double_offered",
        game_id: msg.game_id,
        player: result.player,
        cube_value: result.cubeValue,
      });
      break;
    }

    case "accept_double": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = gameManager.handleAcceptDouble(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot accept double", code: "CANNOT_ACCEPT" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "double_accepted",
        game_id: msg.game_id,
        cube_value: result.cubeValue,
        cube_owner: result.cubeOwner,
      });
      break;
    }

    case "reject_double": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const result = gameManager.handleRejectDouble(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot reject double", code: "CANNOT_REJECT" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "double_rejected",
        game_id: msg.game_id,
        winner: result.winner,
      });
      socialManager.recordMatchResult(game, result.winner, "normal");
      break;
    }

    case "submit_client_seed": {
      // Handled by commit-reveal dice protocol — currently using player address as seed
      break;
    }

    case "spectate": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }

      const game = gameManager.getGame(msg.game_id);
      if (!game) { send(ws, { type: "error", message: "Game not found" }); return; }

      game.spectators.push({
        ws,
        address: conn.address,
        rating: conn.rating,
        connectedAt: Date.now(),
      });

      send(ws, {
        type: "spectate_joined",
        game_id: msg.game_id,
        game_state: game.gameState,
      });
      break;
    }

    // Social message routing
    case "set_profile":
    case "set_username":
    case "search_players":
    case "get_friends":
    case "send_friend_request":
    case "accept_friend_request":
    case "reject_friend_request":
    case "remove_friend":
    case "get_activity":
    case "challenge_friend":
    case "accept_challenge":
    case "decline_challenge": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not authenticated" }); return; }
      socialManager.handle(ws, conn.address, msg);
      break;
    }
  }
}

// Periodically clean up stale online players whose heartbeat keys have expired
setInterval(async () => {
  try {
    await socialStore.cleanupStaleOnlinePlayers();
  } catch { /* ignore */ }
}, 60_000); // Every minute

server.listen(PORT, () => {
  logger.info("Server started", { port: PORT, ws: `/ws`, health: `/health` });

  gameManager.restoreGames().then((count) => {
    if (count > 0) console.log(`Restored ${count} active games from Redis`);
  });
});
