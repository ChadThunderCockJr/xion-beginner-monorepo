import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GameState, Player, Move } from "@xion-beginner/backgammon-core";
import { canDouble as checkCanDouble } from "@xion-beginner/backgammon-core";
import { useAbstraxionSigningClient } from "@burnt-labs/abstraxion";
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
  lastReaction: { emoji: string; from: string } | null;
  pendingConfirmation: boolean;
  forcedMoveNotice: boolean;
  disconnectCountdown: number | null;
  doubleOffered: boolean;
  doubleOfferedBy: Player | null;
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
      legalMoves: Move[];
      myAddress: string;
    }
  | {
      type: "GAME_SYNC";
      gameState: GameState;
      legalMoves: Move[];
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
  | { type: "DISCONNECT_COUNTDOWN"; countdown: number }
  | { type: "REACTION_RECEIVED"; emoji: string; from: string }
  | { type: "CLEAR_REACTION" }
  | { type: "DOUBLE_OFFERED"; player: Player; cubeValue: number }
  | { type: "DOUBLE_ACCEPTED"; cubeValue: number; cubeOwner: Player }
  | { type: "DOUBLE_REJECTED"; winner: Player };

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
  lastReaction: null,
  pendingConfirmation: false,
  forcedMoveNotice: false,
  disconnectCountdown: null,
  doubleOffered: false,
  doubleOfferedBy: null,
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
        legalMoves: action.legalMoves,
        error: null,
        undoCount: 0,
        turnStartedAt: action.gameState.dice ? Date.now() : null,
        lastOpponentMove: null,
        doubleOffered: false,
        doubleOfferedBy: null,
      };
    }
    case "GAME_SYNC": {
      // Reconnection: update game state but preserve timer and undo state
      const hasDice = action.gameState.dice !== null;
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: action.legalMoves,
        // Preserve turnStartedAt if we already have one; otherwise set if dice active
        turnStartedAt: state.turnStartedAt ?? (hasDice ? Date.now() : null),
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
        doubleOffered: false,
        doubleOfferedBy: null,
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
        doubleOffered: false,
        doubleOfferedBy: null,
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
        doubleOffered: false,
        doubleOfferedBy: null,
      };
    case "DOUBLE_OFFERED":
      return { ...state, doubleOffered: true, doubleOfferedBy: action.player };
    case "DOUBLE_ACCEPTED":
      return {
        ...state,
        gameState: state.gameState
          ? { ...state.gameState, cubeValue: action.cubeValue, cubeOwner: action.cubeOwner }
          : state.gameState,
        doubleOffered: false,
        doubleOfferedBy: null,
      };
    case "DOUBLE_REJECTED":
      return {
        ...state,
        winner: action.winner,
        status: "finished",
        doubleOffered: false,
        doubleOfferedBy: null,
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
    case "REACTION_RECEIVED":
      return { ...state, lastReaction: { emoji: action.emoji, from: action.from } };
    case "CLEAR_REACTION":
      return { ...state, lastReaction: null };
    default:
      return state;
  }
}

export function useGame(wsUrl: string, address: string | null) {
  const { connect, sendMessage, connected, on } = useWebSocket(wsUrl);
  const [state, dispatch] = useReducer(gameReducer, initialGameContext);
  const { signArb, client: abstraxionClient } = useAbstraxionSigningClient();
  const addressRef = useRef(address);
  addressRef.current = address;
  const myColorRef = useRef(state.myColor);
  myColorRef.current = state.myColor;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track auth_challenge nonce from server
  const [authNonce, setAuthNonce] = useState<string | null>(null);
  const authSentRef = useRef(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Connect when address is available
  useEffect(() => {
    if (address) {
      connect();
    }
  }, [address, connect]);

  // Listen for auth_challenge from server
  useEffect(() => {
    const unsub = on("auth_challenge", (msg) => {
      setAuthNonce(msg.nonce as string);
      authSentRef.current = false;
    });
    return unsub;
  }, [on]);

  // Listen for auth_ok — marks authentication as complete
  useEffect(() => {
    const unsub = on("auth_ok", () => setAuthenticated(true));
    return unsub;
  }, [on]);

  // Authenticate with wallet signature once nonce + signing are available
  useEffect(() => {
    if (!connected || !address || !authNonce || authSentRef.current) return;

    if (signArb && abstraxionClient) {
      let cancelled = false;
      (async () => {
        try {
          // Get session key account data from the Abstraxion signing client
          const accountData = await abstraxionClient.getGranteeAccountData();
          if (!accountData) throw new Error("No grantee account data available");
          // Sign the nonce with the session key
          const signature = await signArb(accountData.address, authNonce);
          const pubkey = btoa(String.fromCharCode(...accountData.pubkey));
          if (!cancelled) {
            sendMessage({
              type: "auth",
              address,
              signature,
              pubkey,
              nonce: authNonce,
              signer_address: accountData.address,
            });
            authSentRef.current = true;
          }
        } catch (err) {
          console.error("[useGame] Wallet signing failed, sending unsigned auth:", err);
          if (!cancelled) {
            sendMessage({ type: "auth", address });
            authSentRef.current = true;
          }
        }
      })();
      return () => { cancelled = true; };
    }

    // signArb not available — send unsigned auth as fallback
    // (server with SKIP_AUTH_VERIFICATION=true will accept it)
    sendMessage({ type: "auth", address });
    authSentRef.current = true;
  }, [connected, address, authNonce, signArb, abstraxionClient, sendMessage]);

  // Reset auth and queue state on disconnect
  useEffect(() => {
    if (!connected) {
      setAuthenticated(false);
      if (state.status === "queued") {
        dispatch({ type: "QUEUE_LEFT" });
      }
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
      on("game_start", (msg) => {
        const gameId = msg.game_id as string;
        const gs = msg.game_state as GameState;
        const legalMoves = (msg.legal_moves || []) as Move[];

        // Register this WebSocket as the game WebSocket for this player
        sendMessage({ type: "rejoin_game", game_id: gameId });

        // If already playing the same game, this is a reconnection — sync state
        // without resetting timer/undo/etc.
        if (stateRef.current.status === "playing" && stateRef.current.gameId === gameId) {
          dispatch({ type: "GAME_SYNC", gameState: gs, legalMoves });
          return;
        }

        dispatch({
          type: "GAME_START",
          gameId,
          white: msg.white as string,
          black: msg.black as string,
          whiteName: msg.white_name as string | undefined,
          blackName: msg.black_name as string | undefined,
          gameState: gs,
          legalMoves,
          myAddress: addressRef.current || "",
        });
      }),
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
      on("double_offered", (msg) =>
        dispatch({
          type: "DOUBLE_OFFERED",
          player: msg.player as Player,
          cubeValue: msg.cube_value as number,
        })
      ),
      on("double_accepted", (msg) =>
        dispatch({
          type: "DOUBLE_ACCEPTED",
          cubeValue: msg.cube_value as number,
          cubeOwner: msg.cube_owner as Player,
        })
      ),
      on("double_rejected", (msg) =>
        dispatch({
          type: "DOUBLE_REJECTED",
          winner: msg.winner as Player,
        })
      ),
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
      on("reaction", (msg) =>
        dispatch({
          type: "REACTION_RECEIVED",
          emoji: msg.emoji as string,
          from: msg.from as string,
        })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, sendMessage]);

  // Clear last opponent move after 3 seconds
  useEffect(() => {
    if (state.lastOpponentMove) {
      const timer = setTimeout(() => dispatch({ type: "CLEAR_LAST_MOVE" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.lastOpponentMove]);

  // Clear incoming reaction after 3 seconds
  useEffect(() => {
    if (state.lastReaction) {
      const timer = setTimeout(() => dispatch({ type: "CLEAR_REACTION" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.lastReaction]);

  // No forced move auto-play — player always confirms manually

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

  const offerDouble = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "offer_double", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const acceptDouble = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "accept_double", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const rejectDouble = useCallback(() => {
    if (state.gameId)
      sendMessage({ type: "reject_double", game_id: state.gameId });
  }, [sendMessage, state.gameId]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (state.gameId) {
        sendMessage({ type: "reaction", game_id: state.gameId, emoji });
      }
    },
    [sendMessage, state.gameId],
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  // Compute canDouble from game state
  const myCanDouble = state.gameState && state.myColor
    ? checkCanDouble(state.gameState, state.myColor)
    : false;

  return {
    ...state,
    canUndo: state.undoCount > 0 || state.pendingConfirmation,
    canDouble: myCanDouble,
    connected,
    authenticated,
    createGame,
    joinGame,
    joinQueue,
    leaveQueue,
    rollDice,
    makeMove,
    endTurn,
    undoMove,
    resign,
    offerDouble,
    acceptDouble,
    rejectDouble,
    sendReaction,
    reset,
  };
}
