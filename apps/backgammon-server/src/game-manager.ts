import { randomInt } from "node:crypto";
import { GameDiceHistory } from "./dice.js";
import {
  createGameState,
  setDice,
  makeMove,
  endTurn,
  hasLegalMoves,
  getLegalFirstMoves,
  canDouble,
  acceptDouble,
  rejectDouble,
  type GameState,
  type Player,
  type Move,
  type ResultType,
} from "@xion-beginner/backgammon-core";
import { getEscrowClient, getSettlementMultiplier } from "./escrow.js";
import type { ServerGame, PlayerConnection, ServerMessage } from "./types.js";

export class GameManager {
  private games = new Map<string, ServerGame>();
  private playerGames = new Map<string, string>(); // address -> gameId
  private diceHistories = new Map<string, GameDiceHistory>();
  private gameLocks = new Map<string, Promise<void>>();

  private async withGameLock<T>(gameId: string, fn: () => T | Promise<T>): Promise<T> {
    const prev = this.gameLocks.get(gameId) ?? Promise.resolve();
    let resolve: () => void;
    const next = new Promise<void>(r => { resolve = r; });
    this.gameLocks.set(gameId, next);
    await prev;
    try {
      return await fn();
    } finally {
      resolve!();
    }
  }

  private async persistGame(game: ServerGame): Promise<void> {
    try {
      const { getRedis: getR } = await import("./redis.js");
      const r = getR();
      if (!r) return;
      const serializable = {
        id: game.id,
        gameState: game.gameState,
        wagerAmount: game.wagerAmount,
        status: game.status,
        playerWhiteAddress: game.playerWhite?.address || null,
        playerBlackAddress: game.playerBlack?.address || null,
        turnMoveStack: game.turnMoveStack,
        pendingConfirmation: game.pendingConfirmation,
        moveHistory: game.gameState.moveHistory || [],
      };
      await r.set(`active_game:${game.id}`, JSON.stringify(serializable), "EX", 7200); // 2 hour TTL
    } catch {
      // Non-critical — don't crash on persistence failure
    }
  }

  private async deletePersistedGame(gameId: string): Promise<void> {
    try {
      const { getRedis: getR } = await import("./redis.js");
      const r = getR();
      if (!r) return;
      await r.del(`active_game:${gameId}`);
    } catch {
      // Non-critical failure
    }
  }

  async restoreGames(): Promise<number> {
    try {
      const { getRedis: getR } = await import("./redis.js");
      const r = getR();
      if (!r) return 0;
      const keys = await r.keys("active_game:*");
      let restored = 0;
      for (const key of keys) {
        try {
          const raw = await r.get(key);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data.status !== "playing") continue;

          const game: ServerGame = {
            id: data.id,
            gameState: data.gameState,
            wagerAmount: data.wagerAmount,
            status: data.status,
            playerWhite: null, // Players need to reconnect
            playerBlack: null,
            spectators: [],
            createdAt: Date.now(),
            turnTimer: null,
            turnTimeLimit: 60,
            turnMoveStack: data.turnMoveStack || [],
            pendingConfirmation: data.pendingConfirmation || null,
            disconnectTimer: null,
            disconnectedPlayer: null,
            disconnectedAt: null,
            escrowStatus: "none",
            pendingResignation: null,
            moveTimes: [],
            stallingWarned: false,
          };
          this.games.set(game.id, game);

          // Track player-game mappings for reconnection
          if (data.playerWhiteAddress) {
            this.playerGames.set(data.playerWhiteAddress, game.id);
          }
          if (data.playerBlackAddress) {
            this.playerGames.set(data.playerBlackAddress, game.id);
          }
          restored++;
        } catch {
          // Skip corrupted entries
        }
      }
      return restored;
    } catch {
      return 0;
    }
  }

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
      escrowStatus: "none",
      pendingResignation: null,
      moveTimes: [],
      stallingWarned: false,
    };
    this.diceHistories.set(id, new GameDiceHistory());
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

  async rollDiceLocked(gameId: string, playerAddress: string): Promise<{ dice: [number, number]; gameState: GameState; legalMoves: Move[] } | null> {
    return this.withGameLock(gameId, () => this.rollDice(gameId, playerAddress));
  }

  rollDice(gameId: string, playerAddress: string): { dice: [number, number]; gameState: GameState; legalMoves: Move[] } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    if (game.gameState.dice !== null) return null; // already rolled

    // Verify it's this player's turn
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor || playerColor !== game.gameState.currentPlayer) return null;

    game.turnMoveStack = [];

    // Commit-reveal dice: create commit, use player address as client seed
    const diceHistory = this.diceHistories.get(gameId);
    const turnNumber = game.gameState.turnNumber + 1; // setDice increments turnNumber
    let die1: number;
    let die2: number;

    if (diceHistory) {
      const { commitHash } = diceHistory.createTurnCommit(turnNumber);
      // Use player address as client seed for simplicity
      // (full protocol would have player submit their own seed)
      const revealed = diceHistory.revealDice(turnNumber, playerAddress);
      if (revealed) {
        die1 = revealed.dice[0];
        die2 = revealed.dice[1];
      } else {
        die1 = randomInt(1, 7);
        die2 = randomInt(1, 7);
      }
    } else {
      die1 = randomInt(1, 7);
      die2 = randomInt(1, 7);
    }

    game.gameState = setDice(game.gameState, die1, die2);

    const legalMoves = getLegalFirstMoves(
      game.gameState.board,
      game.gameState.currentPlayer,
      game.gameState.movesRemaining
    );

    // Start turn timer — player must always confirm, even with no legal moves
    this.startTurnTimer(game);

    void this.persistGame(game);

    return { dice: [die1, die2], gameState: game.gameState, legalMoves };
  }

  async applyMoveLocked(gameId: string, playerAddress: string, from: number, to: number): Promise<{ move: Move; playerColor: Player; gameState: GameState; legalMoves: Move[]; turnAutoEnded: boolean } | null> {
    return this.withGameLock(gameId, () => this.applyMove(gameId, playerAddress, from, to));
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
      void this.deletePersistedGame(gameId);
    }

    // If turn auto-ended (currentPlayer changed), set pending confirmation
    const turnAutoEnded = newState.currentPlayer !== playerColor && !newState.gameOver;
    if (turnAutoEnded) {
      game.pendingConfirmation = playerAddress;
      // Don't clear timer — let it run for confirmation timeout
    }

    void this.persistGame(game);

    return { move, playerColor: playerColor!, gameState: game.gameState, legalMoves, turnAutoEnded };
  }

  async handleEndTurnLocked(gameId: string, playerAddress: string): Promise<GameState | null> {
    return this.withGameLock(gameId, () => this.handleEndTurn(gameId, playerAddress));
  }

  handleEndTurn(gameId: string, playerAddress: string): GameState | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;

    // Handle pendingConfirmation: player confirms the auto-ended turn
    if (game.pendingConfirmation === playerAddress) {
      game.pendingConfirmation = null;
      game.turnMoveStack = [];
      this.clearTurnTimer(game);
      void this.persistGame(game);
      return game.gameState;
    }

    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor || playerColor !== game.gameState.currentPlayer) return null;

    // Can only end turn if no legal moves remain or player has used their dice
    if (hasLegalMoves(game.gameState)) return null;

    game.turnMoveStack = [];
    game.gameState = endTurn(game.gameState);
    this.clearTurnTimer(game);

    void this.persistGame(game);

    return game.gameState;
  }

  async handleUndoLocked(gameId: string, playerAddress: string): Promise<{ gameState: GameState; legalMoves: Move[] } | null> {
    return this.withGameLock(gameId, () => this.handleUndo(gameId, playerAddress));
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

    void this.persistGame(game);

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
    void this.deletePersistedGame(gameId);

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
      this.diceHistories.delete(gameId);
      this.gameLocks.delete(gameId);
      void this.deletePersistedGame(gameId);
    }
  }

  // ── Doubling Cube ─────────────────────────────────────────────

  handleOfferDouble(gameId: string, playerAddress: string): { player: Player; cubeValue: number } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;
    if (!canDouble(game.gameState, playerColor)) return null;
    return { player: playerColor, cubeValue: game.gameState.cubeValue * 2 };
  }

  handleAcceptDouble(gameId: string, playerAddress: string): { cubeValue: number; cubeOwner: Player } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;
    game.gameState = acceptDouble(game.gameState, playerColor);
    void this.persistGame(game);
    return { cubeValue: game.gameState.cubeValue, cubeOwner: game.gameState.cubeOwner! };
  }

  handleRejectDouble(gameId: string, playerAddress: string): { winner: Player } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;
    const result = rejectDouble(game.gameState, playerColor);
    game.gameState = result.state;
    game.status = "finished";
    this.clearTurnTimer(game);
    void this.deletePersistedGame(gameId);
    return { winner: result.winner };
  }

  // ── Typed Resignation ─────────────────────────────────────────

  handleResignationTyped(
    gameId: string,
    playerAddress: string,
    resignType: "normal" | "gammon" | "backgammon" = "normal",
  ): { offered: boolean; winner?: Player; loser?: Player; resignType: string } | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== "playing") return null;
    const playerColor = this.getPlayerColor(game, playerAddress);
    if (!playerColor) return null;

    // If resign type is not "normal", offer it for opponent to accept/reject
    if (resignType !== "normal") {
      game.pendingResignation = { player: playerAddress, resignType };
      return { offered: true, resignType };
    }

    // Normal resignation — immediate
    const winner: Player = playerColor === "white" ? "black" : "white";
    game.status = "finished";
    game.gameState = { ...game.gameState, gameOver: true, winner, resultType: "normal" };
    this.clearTurnTimer(game);
    void this.deletePersistedGame(gameId);
    return { offered: false, winner, loser: playerColor, resignType: "normal" };
  }

  handleAcceptResignation(gameId: string, playerAddress: string): { winner: Player; resultType: ResultType } | null {
    const game = this.games.get(gameId);
    if (!game || !game.pendingResignation) return null;
    const resigningColor = this.getPlayerColor(game, game.pendingResignation.player);
    const acceptingColor = this.getPlayerColor(game, playerAddress);
    if (!resigningColor || !acceptingColor || resigningColor === acceptingColor) return null;

    const winner = acceptingColor;
    const resultType = game.pendingResignation.resignType as ResultType;
    game.status = "finished";
    game.gameState = { ...game.gameState, gameOver: true, winner, resultType };
    game.pendingResignation = null;
    this.clearTurnTimer(game);
    void this.deletePersistedGame(gameId);
    return { winner, resultType };
  }

  handleRejectResignation(gameId: string, playerAddress: string): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.pendingResignation) return false;
    const resigningColor = this.getPlayerColor(game, game.pendingResignation.player);
    const rejectingColor = this.getPlayerColor(game, playerAddress);
    if (!resigningColor || !rejectingColor || resigningColor === rejectingColor) return false;
    game.pendingResignation = null;
    return true;
  }

  // ── Escrow Integration ────────────────────────────────────────

  async createEscrowForGame(gameId: string, playerA: string, playerB: string, wagerAmount: number): Promise<boolean> {
    const escrow = getEscrowClient();
    if (!escrow) return false;
    const game = this.games.get(gameId);
    if (!game) return false;

    const [balA, balB] = await Promise.all([
      escrow.queryBalance(playerA),
      escrow.queryBalance(playerB),
    ]);
    if (parseInt(balA) < wagerAmount || parseInt(balB) < wagerAmount) return false;

    const created = await escrow.createEscrow(gameId, playerA, playerB, String(wagerAmount));
    if (created) {
      game.escrowStatus = "pending_deposits";
      void this.persistGame(game);
    }
    return created;
  }

  async settleEscrow(gameId: string, winner: string, resultType: ResultType): Promise<boolean> {
    const escrow = getEscrowClient();
    if (!escrow) return false;
    const game = this.games.get(gameId);
    if (!game || game.escrowStatus !== "active") return false;

    const multiplier = getSettlementMultiplier(resultType, game.gameState.cubeValue);
    const settled = await escrow.settle(gameId, winner, multiplier);
    if (settled) game.escrowStatus = "settled";
    return settled;
  }

  // ── Stalling Detection ────────────────────────────────────────

  checkStalling(game: ServerGame, playerAddress: string): { warn: boolean; penalize: boolean } {
    if (game.moveTimes.length < 3) return { warn: false, penalize: false };

    const recent = game.moveTimes.slice(-3);
    const avgTime = recent.reduce((a, b) => a + b, 0) / recent.length;
    const turnLimit = game.turnTimeLimit * 1000;

    if (avgTime > turnLimit * 0.8) {
      if (game.stallingWarned) return { warn: false, penalize: true };
      return { warn: true, penalize: false };
    }
    return { warn: false, penalize: false };
  }

  getDiceHistory(gameId: string): Array<{
    turnNumber: number;
    serverSeed: string;
    clientSeed: string;
    commitHash: string;
    dice: [number, number];
  }> {
    const history = this.diceHistories.get(gameId);
    return history ? history.getHistory() : [];
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
          void this.deletePersistedGame(game.id);
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
