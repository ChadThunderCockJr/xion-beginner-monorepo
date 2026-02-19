import { useCallback, useEffect, useReducer, useRef } from "react";
import type { GameState, Player, Move } from "@xion-beginner/backgammon-core";
import { useWebSocket } from "./useWebSocket";
import {
  playDiceRoll,
  playCheckerPlace,
  playCheckerHit,
  playTurnEnd,
  playGameOver,
} from "@/lib/sounds";

interface GameContext {
  gameId: string | null;
  myColor: Player | null;
  gameState: GameState | null;
  legalMoves: Move[];
  opponent: string | null;
  status: "idle" | "waiting" | "queued" | "playing" | "finished";
  winner: Player | null;
  resultType: string | null;
  opponentDisconnected: boolean;
  error: string | null;
  undoCount: number;
  turnStartedAt: number | null;
  lastOpponentMove: { from: number; to: number } | null;
  pendingConfirmation: boolean;
  forcedMoveNotice: boolean;
  disconnectCountdown: number | null;
}

type GameAction =
  | { type: "GAME_CREATED"; gameId: string; color: Player }
  | { type: "GAME_JOINED"; gameId: string; color: Player; opponent: string; opponentName?: string }
  | {
      type: "GAME_START";
      gameId: string;
      white: string;
      black: string;
      whiteName?: string;
      blackName?: string;
      gameState: GameState;
      myAddress: string;
    }
  | { type: "DICE_ROLLED"; gameState: GameState; legalMoves: Move[]; player: Player; needsConfirmation?: boolean }
  | { type: "MOVE_MADE"; gameState: GameState; legalMoves: Move[]; player: Player; move: Move; needsConfirmation?: boolean }
  | { type: "MOVE_UNDONE"; gameState: GameState; legalMoves: Move[] }
  | { type: "TURN_ENDED"; gameState: GameState }
  | {
      type: "GAME_OVER";
      winner: Player;
      resultType: string;
      gameState: GameState;
    }
  | { type: "OPPONENT_DISCONNECTED" }
  | { type: "OPPONENT_RECONNECTED" }
  | { type: "QUEUED" }
  | { type: "QUEUE_LEFT" }
  | { type: "ERROR"; message: string }
  | { type: "RESET" }
  | { type: "CLEAR_LAST_MOVE" }
  | { type: "FORCED_MOVE_NOTICE"; on: boolean }
  | { type: "OPPONENT_DISCONNECTING"; countdown: number }
  | { type: "DISCONNECT_COUNTDOWN"; countdown: number };

const initialGameContext: GameContext = {
  gameId: null,
  myColor: null,
  gameState: null,
  legalMoves: [],
  opponent: null,
  status: "idle",
  winner: null,
  resultType: null,
  opponentDisconnected: false,
  error: null,
  undoCount: 0,
  turnStartedAt: null,
  lastOpponentMove: null,
  pendingConfirmation: false,
  forcedMoveNotice: false,
  disconnectCountdown: null,
};

function gameReducer(state: GameContext, action: GameAction): GameContext {
  switch (action.type) {
    case "GAME_CREATED":
      return {
        ...state,
        gameId: action.gameId,
        myColor: action.color,
        status: "waiting",
        error: null,
      };
    case "GAME_JOINED":
      return {
        ...state,
        gameId: action.gameId,
        myColor: action.color,
        opponent: action.opponentName || action.opponent,
        status: "waiting",
        error: null,
      };
    case "GAME_START": {
      const myColor =
        state.myColor ||
        (action.white === action.myAddress ? "white" : "black");
      const opponent = myColor === "white"
        ? (action.blackName || action.black)
        : (action.whiteName || action.white);
      return {
        ...state,
        gameId: action.gameId,
        myColor,
        opponent,
        gameState: action.gameState,
        status: "playing",
        legalMoves: [],
        error: null,
        undoCount: 0,
        turnStartedAt: null,
        lastOpponentMove: null,
      };
    }
    case "DICE_ROLLED":
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: action.legalMoves,
        undoCount: 0,
        turnStartedAt: Date.now(),
        lastOpponentMove: null,
        pendingConfirmation: action.needsConfirmation ? true : false,
      };
    case "MOVE_MADE": {
      const iMadeIt = state.myColor !== null && action.player === state.myColor;
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: action.legalMoves,
        undoCount: iMadeIt ? state.undoCount + 1 : state.undoCount,
        lastOpponentMove: !iMadeIt
          ? { from: action.move.from, to: action.move.to }
          : state.lastOpponentMove,
        pendingConfirmation: iMadeIt && action.needsConfirmation ? true : state.pendingConfirmation,
      };
    }
    case "MOVE_UNDONE":
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: action.legalMoves,
        undoCount: Math.max(0, state.undoCount - 1),
      };
    case "TURN_ENDED":
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: [],
        undoCount: 0,
        turnStartedAt: Date.now(),
        pendingConfirmation: false,
      };
    case "GAME_OVER":
      return {
        ...state,
        gameState: action.gameState,
        winner: action.winner,
        resultType: action.resultType,
        status: "finished",
        legalMoves: [],
        undoCount: 0,
        turnStartedAt: null,
      };
    case "OPPONENT_DISCONNECTED":
      return { ...state, opponentDisconnected: true };
    case "OPPONENT_RECONNECTED":
      return { ...state, opponentDisconnected: false, disconnectCountdown: null };
    case "FORCED_MOVE_NOTICE":
      return { ...state, forcedMoveNotice: action.on };
    case "OPPONENT_DISCONNECTING":
      return { ...state, opponentDisconnected: true, disconnectCountdown: action.countdown };
    case "DISCONNECT_COUNTDOWN":
      return { ...state, disconnectCountdown: action.countdown };
    case "QUEUED":
      return { ...state, status: "queued", error: null };
    case "QUEUE_LEFT":
      return { ...state, status: "idle" };
    case "ERROR":
      return { ...state, error: action.message };
    case "RESET":
      return initialGameContext;
    case "CLEAR_LAST_MOVE":
      return { ...state, lastOpponentMove: null };
    default:
      return state;
  }
}

export function useGame(wsUrl: string, address: string | null) {
  const { connect, sendMessage, connected, on } = useWebSocket(wsUrl);
  const [state, dispatch] = useReducer(gameReducer, initialGameContext);
  const addressRef = useRef(address);
  addressRef.current = address;
  const myColorRef = useRef(state.myColor);
  myColorRef.current = state.myColor;

  // Connect when address is available
  useEffect(() => {
    if (address) {
      connect();
    }
  }, [address, connect]);

  // Authenticate once connected
  useEffect(() => {
    if (connected && address) {
      sendMessage({ type: "auth", address });
    }
  }, [connected, address, sendMessage]);

  // Reset queue state on disconnect (server queue is lost on restart)
  useEffect(() => {
    if (!connected && state.status === "queued") {
      dispatch({ type: "QUEUE_LEFT" });
    }
  }, [connected, state.status]);

  // Register message handlers
  useEffect(() => {
    const unsubs = [
      on("game_created", (msg) =>
        dispatch({
          type: "GAME_CREATED",
          gameId: msg.game_id as string,
          color: msg.color as Player,
        })
      ),
      on("game_joined", (msg) =>
        dispatch({
          type: "GAME_JOINED",
          gameId: msg.game_id as string,
          color: msg.color as Player,
          opponent: msg.opponent as string,
          opponentName: msg.opponent_name as string | undefined,
        })
      ),
      on("game_start", (msg) =>
        dispatch({
          type: "GAME_START",
          gameId: msg.game_id as string,
          white: msg.white as string,
          black: msg.black as string,
          whiteName: msg.white_name as string | undefined,
          blackName: msg.black_name as string | undefined,
          gameState: msg.game_state as GameState,
          myAddress: addressRef.current || "",
        })
      ),
      on("dice_rolled", (msg) => {
        playDiceRoll();
        dispatch({
          type: "DICE_ROLLED",
          gameState: msg.game_state as GameState,
          legalMoves: (msg.legal_moves || []) as Move[],
          player: msg.player as Player,
          needsConfirmation: msg.needs_confirmation as boolean | undefined,
        });
      }),
      on("move_made", (msg) => {
        const player = msg.player as Player;
        const move = msg.move as Move;
        const gs = msg.game_state as GameState;
        const isHit = player !== myColorRef.current;
        if (isHit) {
          playCheckerHit();
        } else {
          playCheckerPlace();
        }
        dispatch({
          type: "MOVE_MADE",
          gameState: gs,
          legalMoves: (msg.legal_moves || []) as Move[],
          player,
          move,
          needsConfirmation: msg.needs_confirmation as boolean | undefined,
        });
      }),
      on("move_undone", (msg) => {
        dispatch({
          type: "MOVE_UNDONE",
          gameState: msg.game_state as GameState,
          legalMoves: (msg.legal_moves || []) as Move[],
        });
      }),
      on("turn_ended", (msg) => {
        playTurnEnd();
        dispatch({
          type: "TURN_ENDED",
          gameState: msg.game_state as GameState,
        });
      }),
      on("game_over", (msg) => {
        const winner = msg.winner as Player;
        playGameOver(winner === myColorRef.current);
        dispatch({
          type: "GAME_OVER",
          winner,
          resultType: msg.result_type as string,
          gameState: msg.game_state as GameState,
        });
      }),
      on("opponent_disconnected", () =>
        dispatch({ type: "OPPONENT_DISCONNECTED" })
      ),
      on("opponent_reconnected", () =>
        dispatch({ type: "OPPONENT_RECONNECTED" })
      ),
      on("opponent_disconnecting", (msg) =>
        dispatch({ type: "OPPONENT_DISCONNECTING", countdown: msg.grace_seconds as number })
      ),
      on("disconnect_countdown", (msg) =>
        dispatch({ type: "DISCONNECT_COUNTDOWN", countdown: msg.seconds_remaining as number })
      ),
      on("queue_joined", () => dispatch({ type: "QUEUED" })),
      on("queue_left", () => dispatch({ type: "QUEUE_LEFT" })),
      on("error", (msg) =>
        dispatch({ type: "ERROR", message: msg.message as string })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // Clear last opponent move after 3 seconds
  useEffect(() => {
    if (state.lastOpponentMove) {
      const timer = setTimeout(() => dispatch({ type: "CLEAR_LAST_MOVE" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.lastOpponentMove]);

  // Ref to current state for timeout callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // Forced move auto-play: when only one legal move exists for this step
  useEffect(() => {
    if (
      state.gameState &&
      state.gameState.dice !== null &&
      state.myColor === state.gameState.currentPlayer &&
      state.legalMoves.length > 0
    ) {
      const uniqueFromTo = new Set(state.legalMoves.map((m) => `${m.from}-${m.to}`));
      if (uniqueFromTo.size === 1) {
        // All legal moves share the same from-to — truly forced
        dispatch({ type: "FORCED_MOVE_NOTICE", on: true });
        const move = state.legalMoves[0];
        const timer = setTimeout(() => {
          if (stateRef.current.gameId) {
            sendMessage({ type: "move", game_id: stateRef.current.gameId, from: move.from, to: move.to });
          }
        }, 500);
        return () => clearTimeout(timer);
      }

      // Per-die check: if each die value has at most one unique from-to,
      // the whole step is determined (player has no meaningful choice)
      const dice = state.gameState.dice;
      if (dice[0] !== dice[1]) {
        const byDie = new Map<number, Set<string>>();
        for (const m of state.legalMoves) {
          const d = (m as { die?: number }).die;
          if (d != null) {
            if (!byDie.has(d)) byDie.set(d, new Set());
            byDie.get(d)!.add(`${m.from}-${m.to}`);
          }
        }
        // Each die has exactly one option (or zero — no moves for that die)
        const allForced = [...byDie.values()].every((s) => s.size <= 1);
        if (allForced && byDie.size > 0) {
          dispatch({ type: "FORCED_MOVE_NOTICE", on: true });
          const move = state.legalMoves[0];
          const timer = setTimeout(() => {
            if (stateRef.current.gameId) {
              sendMessage({ type: "move", game_id: stateRef.current.gameId, from: move.from, to: move.to });
            }
          }, 500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [state.legalMoves, state.gameState?.dice, state.myColor, state.gameState?.currentPlayer, sendMessage, state.gameId]);

  // Clear forced move notice after 2 seconds
  useEffect(() => {
    if (state.forcedMoveNotice) {
      const timer = setTimeout(() => dispatch({ type: "FORCED_MOVE_NOTICE", on: false }), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.forcedMoveNotice]);

  const createGame = useCallback(
    (wagerAmount: number) => {
      sendMessage({ type: "create_game", wager_amount: wagerAmount });
    },
    [sendMessage]
  );

  const joinGame = useCallback(
    (gameId: string) => {
      sendMessage({ type: "join_game", game_id: gameId });
    },
    [sendMessage]
  );

  const joinQueue = useCallback(
    (wagerAmount: number) => {
      sendMessage({ type: "join_queue", wager_amount: wagerAmount });
    },
    [sendMessage]
  );

  const leaveQueue = useCallback(() => {
    sendMessage({ type: "leave_queue" });
  }, [sendMessage]);

  const rollDice = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "roll_dice", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const makeMove = useCallback(
    (from: number, to: number) => {
      if (state.gameId)
        sendMessage({ type: "move", game_id: state.gameId, from, to });
    },
    [sendMessage, state.gameId]
  );

  const endTurn = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "end_turn", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const undoMove = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "undo_move", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const resign = useCallback(() => {
    if (state.gameId) sendMessage({ type: "resign", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    canUndo: state.undoCount > 0 || state.pendingConfirmation,
    connected,
    createGame,
    joinGame,
    joinQueue,
    leaveQueue,
    rollDice,
    makeMove,
    endTurn,
    undoMove,
    resign,
    reset,
  };
}
