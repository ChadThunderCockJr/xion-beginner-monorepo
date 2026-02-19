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

const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();
app.use(cors());
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
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
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
const wss = new WebSocketServer({ server, path: "/ws" });

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

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection");

  ws.on("message", (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    handleMessage(ws, msg);
  });

  ws.on("close", () => {
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
  switch (msg.type) {
    case "auth": {
      // For MVP, trust the address (production would verify signature)
      const ratingInfo = await socialStore.getRating(msg.address);
      connections.set(ws, { address: msg.address, rating: ratingInfo.rating });
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

      const result = gameManager.rollDice(msg.game_id, conn.address);
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

      const result = gameManager.applyMove(msg.game_id, conn.address, msg.from, msg.to);
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

      const result = gameManager.handleEndTurn(msg.game_id, conn.address);
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

      const result = gameManager.handleUndo(msg.game_id, conn.address);
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

      const result = gameManager.handleResignation(msg.game_id, conn.address);
      if (!result) { send(ws, { type: "error", message: "Cannot resign", code: "CANNOT_RESIGN" }); return; }

      const game = gameManager.getGame(msg.game_id)!;
      gameManager.broadcastToGame(game, {
        type: "game_over",
        game_id: msg.game_id,
        winner: result.winner,
        result_type: "normal",
        game_state: game.gameState,
      });
      socialManager.recordMatchResult(game, result.winner, "normal");
      socialStore.saveGameHistory(game.id, game.gameState.moveHistory);
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

server.listen(PORT, () => {
  console.log(`Backgammon server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
