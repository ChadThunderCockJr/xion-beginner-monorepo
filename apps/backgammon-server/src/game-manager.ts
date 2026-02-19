import { randomInt } from "node:crypto";
import {
  createGameState,
  setDice,
  makeMove,
  endTurn,
  hasLegalMoves,
  getLegalFirstMoves,
  type GameState,
  type Player,
  type Move,
} from "@xion-beginner/backgammon-core";
import type { ServerGame, PlayerConnection, ServerMessage } from "./types.js";

export class GameManager {
  private games = new Map<string, ServerGame>();
  private playerGames = new Map<string, string>(); // address -> gameId

  private generateShortId(): string {
    // Generate a 4-digit numeric code, retry on collision
    for (let i = 0; i < 100; i++) {
      const id = String(randomInt(1000, 10000));
      if (!this.games.has(id)) return id;
    }
    // Fallback: append timestamp fragment
    return String(randomInt(1000, 10000)) + String(Date.now() % 1000);
  }

  createGame(wagerAmount: number): ServerGame {
    const id = this.generateShortId();
    const game: ServerGame = {
      id,
      gameState: createGameState(),
      playerWhite: null,
      playerBlack: null,
      spectators: [],
      wagerAmount,
      status: "waiting",
      createdAt: Date.now(),
      turnTimer: null,
      turnTimeLimit: 60,
      turnMoveStack: [],
      pendingConfirmation: null,
      disconnectTimer: null,
      disconnectedPlayer: null,
      disconnectedAt: null,
    };
    this.games.set(id, game);
    return game;
  }

  getGame(id: string): ServerGame | undefined {
    return this.games.get(id);
  }

  getPlayerGame(address: string): string | undefined {
    return this.playerGames.get(address);
  }

  joinGame(gameId: string, player: PlayerConnection): { color: Player } | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    if (!game.playerWhite) {
      game.playerWhite = player;
      this.playerGames.set(player.address, gameId);
      return { color: "white" };
    } else if (!game.playerBlack && game.playerWhite.address !== player.address) {
      game.playerBlack = player;
      this.playerGames.set(player.address, gameId);
      game.status = "playing";
      return { color: "black" };
    }
    return null;
  }

  rollDice(gameId: string, playerAddress: string): { dice: [number, number]; gameState: GameState; legalMoves: Move[] } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    if (game.gameState.dice !== null) return null; // already rolled

    // Verify it's this player's turn
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor || playerColor !== game.gameState.currentPlayer) return null;

    const die1 = randomInt(1, 7);
    const die2 = randomInt(1, 7);
    game.turnMoveStack = [];
    game.gameState = setDice(game.gameState, die1, die2);

    const legalMoves = getLegalFirstMoves(
      game.gameState.board,
      game.gameState.currentPlayer,
      game.gameState.movesRemaining
    );

    // Start turn timer — player must always confirm, even with no legal moves
    this.startTurnTimer(game);

    return { dice: [die1, die2], gameState: game.gameState, legalMoves };
  }

  applyMove(gameId: string, playerAddress: string, from: number, to: number): { move: Move; playerColor: Player; gameState: GameState; legalMoves: Move[]; turnAutoEnded: boolean } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;

    const playerColor = this.getPlayerColor(game, playerAddress);
    // Allow moves when it's the player's turn OR when they have pendingConfirmation (undo then re-move)
    if (!playerColor || (playerColor !== game.gameState.currentPlayer && game.pendingConfirmation !== playerAddress)) return null;
    if (game.gameState.dice === null) return null;

    game.turnMoveStack.push(JSON.parse(JSON.stringify(game.gameState)));
    const newState = makeMove(game.gameState, from, to);
    if (!newState) return null;

    // Find which die was used
    const usedDieValues = game.gameState.movesRemaining.filter(
      (d, i) => !newState.movesRemaining.includes(d) ||
        game.gameState.movesRemaining.indexOf(d) !== newState.movesRemaining.indexOf(d)
    );
    const die = usedDieValues[0] || game.gameState.movesRemaining[0];

    const move: Move = { from, to, die };
    game.gameState = newState;

    // Get remaining legal moves
    const legalMoves = newState.movesRemaining.length > 0
      ? getLegalFirstMoves(newState.board, newState.currentPlayer, newState.movesRemaining)
      : [];

    // Check if game is over
    if (newState.gameOver) {
      game.status = "finished";
      this.clearTurnTimer(game);
    }

    // If turn auto-ended (currentPlayer changed), set pending confirmation
    const turnAutoEnded = newState.currentPlayer !== playerColor && !newState.gameOver;
    if (turnAutoEnded) {
      game.pendingConfirmation = playerAddress;
      // Don't clear timer — let it run for confirmation timeout
    }

    return { move, playerColor: playerColor!, gameState: game.gameState, legalMoves, turnAutoEnded };
  }

  handleEndTurn(gameId: string, playerAddress: string): GameState | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;

    // Handle pendingConfirmation: player confirms the auto-ended turn
    if (game.pendingConfirmation === playerAddress) {
      game.pendingConfirmation = null;
      game.turnMoveStack = [];
      this.clearTurnTimer(game);
      return game.gameState;
    }

    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor || playerColor !== game.gameState.currentPlayer) return null;

    // Can only end turn if no legal moves remain or player has used their dice
    if (hasLegalMoves(game.gameState)) return null;

    game.turnMoveStack = [];
    game.gameState = endTurn(game.gameState);
    this.clearTurnTimer(game);

    return game.gameState;
  }

  handleUndo(gameId: string, playerAddress: string): { gameState: GameState; legalMoves: Move[] } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;

    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;

    // Allow undo when pendingConfirmation is set (even though currentPlayer changed)
    const isPending = game.pendingConfirmation === playerAddress;
    if (!isPending && playerColor !== game.gameState.currentPlayer) return null;
    if (game.turnMoveStack.length === 0) return null;

    game.gameState = game.turnMoveStack.pop()!;

    // Clear pendingConfirmation if restored state's currentPlayer matches the player
    if (isPending && game.gameState.currentPlayer === playerColor) {
      game.pendingConfirmation = null;
    }

    const legalMoves = getLegalFirstMoves(
      game.gameState.board,
      game.gameState.currentPlayer,
      game.gameState.movesRemaining
    );
    return { gameState: game.gameState, legalMoves };
  }

  handleResignation(gameId: string, playerAddress: string): { winner: Player; loser: Player } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;

    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;

    const winner: Player = playerColor === "white" ? "black" : "white";
    game.status = "finished";
    game.gameState.gameOver = true;
    game.gameState.winner = winner;
    game.gameState.resultType = "normal";
    this.clearTurnTimer(game);

    return { winner, loser: playerColor };
  }

  handleDisconnect(address: string): { gameId: string; game: ServerGame } | null {
    const gameId = this.playerGames.get(address);
    if (!gameId) return null;

    const game = this.games.get(gameId);
    if (!game) return null;

    return { gameId, game };
  }

  handleReconnect(gameId: string, player: PlayerConnection): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    if (game.playerWhite?.address === player.address) {
      game.playerWhite = player;
      return true;
    }
    if (game.playerBlack?.address === player.address) {
      game.playerBlack = player;
      return true;
    }
    return false;
  }

  removeGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      this.clearTurnTimer(game);
      if (game.playerWhite) this.playerGames.delete(game.playerWhite.address);
      if (game.playerBlack) this.playerGames.delete(game.playerBlack.address);
      this.games.delete(gameId);
    }
  }

  getPlayerColor(game: ServerGame, address: string): Player | null {
    if (game.playerWhite?.address === address) return "white";
    if (game.playerBlack?.address === address) return "black";
    return null;
  }

  private startTurnTimer(game: ServerGame): void {
    this.clearTurnTimer(game);
    game.turnTimer = setTimeout(() => {
      if (game.status === "playing" && !game.gameState.gameOver) {
        if (game.pendingConfirmation) {
          // Auto-confirm on timeout
          game.pendingConfirmation = null;
          game.turnMoveStack = [];
          this.broadcastToGame(game, {
            type: "turn_ended",
            game_id: game.id,
            next_player: game.gameState.currentPlayer,
            game_state: game.gameState,
          });
        } else {
          game.turnMoveStack = [];
          game.gameState = endTurn(game.gameState);
          this.broadcastToGame(game, {
            type: "turn_ended",
            game_id: game.id,
            next_player: game.gameState.currentPlayer,
            game_state: game.gameState,
          });
        }
      }
    }, game.turnTimeLimit * 1000);
  }

  private clearTurnTimer(game: ServerGame): void {
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }
  }

  startDisconnectGracePeriod(game: ServerGame, address: string): void {
    this.cancelDisconnectGracePeriod(game);
    game.disconnectedPlayer = address;
    game.disconnectedAt = Date.now();
    const graceSec = 30;

    const opponent = game.playerWhite?.address === address ? game.playerBlack : game.playerWhite;
    if (opponent) {
      this.sendToPlayer(opponent, {
        type: "opponent_disconnecting",
        game_id: game.id,
        grace_seconds: graceSec,
      });
    }

    let elapsed = 0;
    game.disconnectTimer = setInterval(() => {
      elapsed += 5;
      const remaining = graceSec - elapsed;

      if (remaining <= 0) {
        // Grace period expired — forfeit
        this.cancelDisconnectGracePeriod(game);
        const disconnectedColor = this.getPlayerColor(game, address);
        if (disconnectedColor && game.status === "playing") {
          const winner = disconnectedColor === "white" ? "black" : "white";
          game.status = "finished";
          game.gameState.gameOver = true;
          game.gameState.winner = winner;
          game.gameState.resultType = "normal";
          this.clearTurnTimer(game);
          this.broadcastToGame(game, {
            type: "game_over",
            game_id: game.id,
            winner,
            result_type: "normal",
            game_state: game.gameState,
          });
        }
      } else if (opponent) {
        this.sendToPlayer(opponent, {
          type: "disconnect_countdown",
          game_id: game.id,
          seconds_remaining: remaining,
        });
      }
    }, 5000);
  }

  cancelDisconnectGracePeriod(game: ServerGame): void {
    if (game.disconnectTimer) {
      clearInterval(game.disconnectTimer);
      game.disconnectTimer = null;
    }
    game.disconnectedPlayer = null;
    game.disconnectedAt = null;
  }

  broadcastToGame(game: ServerGame, message: ServerMessage): void {
    const data = JSON.stringify(message);
    if (game.playerWhite?.ws.readyState === 1) game.playerWhite.ws.send(data);
    if (game.playerBlack?.ws.readyState === 1) game.playerBlack.ws.send(data);
    for (const spec of game.spectators) {
      if (spec.ws.readyState === 1) spec.ws.send(data);
    }
  }

  sendToPlayer(player: PlayerConnection | null, message: ServerMessage): void {
    if (player?.ws.readyState === 1) {
      player.ws.send(JSON.stringify(message));
    }
  }
}
