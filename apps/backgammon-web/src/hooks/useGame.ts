import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GameState, Player, Move, MatchState } from "@xion-beginner/backgammon-core";
import {
  canDouble as checkCanDouble,
  makeMove as coreMakeMove,
  getLegalFirstMoves,
} from "@xion-beginner/backgammon-core";
import type { TurnRecord } from "./useLocalGame";
import { useAbstraxionSigningClient } from "@burnt-labs/abstraxion";
import { useWebSocket } from "./useWebSocket";
import {
  playDiceRoll,
  playCheckerPlace,
  playCheckerHit,
  playTurnEnd,
  playGameOver,
} from "@/lib/sounds";
import { CLEAR_LAST_MOVE_DELAY_MS, CLEAR_REACTION_DELAY_MS, DEFAULT_TURN_TIME_LIMIT_SEC } from "@/lib/constants";
import { USDC_DENOM } from "@/lib/config";

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
  turnTimeLimit: number;
  lastOpponentMove: { from: number; to: number } | null;
  lastReaction: { emoji: string; from: string } | null;
  pendingConfirmation: boolean;
  forcedMoveNotice: boolean;
  disconnectCountdown: number | null;
  doubleOffered: boolean;
  doubleOfferedBy: Player | null;
  // Double deposit state (wagered games only)
  doubleDepositRequired: boolean;
  doubleDepositAmount: string;
  doubleDepositNewCubeValue: number;
  doubleDepositDoubler: string | null;
  doubleDepositResponder: string | null;
  doubleDepositDoublerDone: boolean;
  doubleDepositResponderDone: boolean;
  doubleDepositComplete: boolean;
  // Turn history for post-game analysis
  turnHistory: TurnRecord[];
  currentTurnPlayer: Player | null;
  currentTurnDice: [number, number] | null;
  currentTurnMoves: { from: number; to: number; die: number }[];
  turnStartBoard: { points: number[]; whiteOff: number; blackOff: number } | null;
  // Match state for multi-game matches
  matchState: MatchState | null;
  matchOver: boolean;
  // Per-game turn histories for match-level analysis
  matchTurnHistory: TurnRecord[][];
  // Client-side move buffering for multiplayer turn confirmation
  bufferedMoves: { from: number; to: number }[];
  localGameState: GameState | null;
  localLegalMoves: Move[];
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
      matchState?: MatchState | null;
      turnTimeLimit?: number;
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
      matchState?: MatchState | null;
      matchOver?: boolean;
    }
  | { type: "NEXT_GAME"; gameId: string; gameState: GameState; matchState: MatchState; myAddress: string; white: string; black: string }
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
  | { type: "DOUBLE_REJECTED"; winner: Player }
  | { type: "DOUBLE_AWAITING_DEPOSITS"; newCubeValue: number; additionalDeposit: string; doubler: string; responder: string }
  | { type: "DOUBLE_DEPOSIT_RECEIVED"; player: string; depositsComplete: boolean }
  | { type: "DOUBLE_DEPOSITS_COMPLETE"; newCubeValue: number; cubeOwner: Player }
  | { type: "DOUBLE_DEPOSIT_TIMEOUT" }
  | { type: "LOCAL_MOVE"; from: number; to: number; die: number; newState: GameState; legalMoves: Move[] }
  | { type: "LOCAL_UNDO" }
  | { type: "CLEAR_BUFFER" };

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
  turnTimeLimit: DEFAULT_TURN_TIME_LIMIT_SEC,
  lastOpponentMove: null,
  lastReaction: null,
  pendingConfirmation: false,
  forcedMoveNotice: false,
  disconnectCountdown: null,
  doubleOffered: false,
  doubleOfferedBy: null,
  doubleDepositRequired: false,
  doubleDepositAmount: "0",
  doubleDepositNewCubeValue: 0,
  doubleDepositDoubler: null,
  doubleDepositResponder: null,
  doubleDepositDoublerDone: false,
  doubleDepositResponderDone: false,
  doubleDepositComplete: false,
  turnHistory: [],
  currentTurnPlayer: null,
  currentTurnDice: null,
  currentTurnMoves: [],
  turnStartBoard: null,
  matchState: null,
  matchOver: false,
  matchTurnHistory: [],
  bufferedMoves: [],
  localGameState: null,
  localLegalMoves: [],
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
        turnHistory: [],
        currentTurnPlayer: null,
        currentTurnDice: null,
        currentTurnMoves: [],
        turnStartBoard: null,
        matchState: action.matchState ?? state.matchState,
        matchOver: false,
        winner: null,
        resultType: null,
        turnTimeLimit: action.turnTimeLimit ?? state.turnTimeLimit,
        // Reset matchTurnHistory for a fresh match (not a next_game continuation)
        matchTurnHistory: [],
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
    case "DICE_ROLLED": {
      const board = action.gameState.board;
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
        currentTurnPlayer: action.player,
        currentTurnDice: action.gameState.dice,
        currentTurnMoves: [],
        turnStartBoard: { points: [...board.points], whiteOff: board.whiteOff, blackOff: board.blackOff },
        // Clear any buffered moves from previous turn
        bufferedMoves: [],
        localGameState: null,
        localLegalMoves: [],
      };
    }
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
        currentTurnMoves: [...state.currentTurnMoves, { from: action.move.from, to: action.move.to, die: action.move.die }],
      };
    }
    case "MOVE_UNDONE":
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: action.legalMoves,
        undoCount: Math.max(0, state.undoCount - 1),
        currentTurnMoves: state.currentTurnMoves.slice(0, -1),
      };
    case "TURN_ENDED": {
      // Finalize turn record before resetting.
      // Use currentTurnPlayer (captured at DICE_ROLLED) because makeMove
      // auto-switches currentPlayer when all dice are used, so
      // state.gameState.currentPlayer is already the NEXT player.
      const turnRecord: TurnRecord | null = state.currentTurnDice ? {
        player: state.currentTurnPlayer ?? state.gameState?.currentPlayer ?? "white",
        dice: state.currentTurnDice,
        moves: state.currentTurnMoves,
        boardBefore: state.turnStartBoard ?? undefined,
      } : null;
      return {
        ...state,
        gameState: action.gameState,
        legalMoves: [],
        undoCount: 0,
        turnStartedAt: null,
        pendingConfirmation: false,
        doubleOffered: false,
        doubleOfferedBy: null,
        turnHistory: turnRecord ? [...state.turnHistory, turnRecord] : state.turnHistory,
        currentTurnPlayer: null,
        currentTurnDice: null,
        currentTurnMoves: [],
        turnStartBoard: null,
        bufferedMoves: [],
        localGameState: null,
        localLegalMoves: [],
      };
    }
    case "GAME_OVER": {
      // Finalize the last turn record.
      // Use currentTurnPlayer (captured at DICE_ROLLED) for consistent player attribution.
      const finalTurnRecord: TurnRecord | null = state.currentTurnDice && state.currentTurnMoves.length > 0 ? {
        player: state.currentTurnPlayer ?? state.gameState?.currentPlayer ?? "white",
        dice: state.currentTurnDice,
        moves: state.currentTurnMoves,
        boardBefore: state.turnStartBoard ?? undefined,
      } : null;
      const finalTurnHistory = finalTurnRecord ? [...state.turnHistory, finalTurnRecord] : state.turnHistory;
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
        turnHistory: finalTurnHistory,
        currentTurnPlayer: null,
        currentTurnDice: null,
        currentTurnMoves: [],
        turnStartBoard: null,
        matchState: action.matchState ?? state.matchState,
        matchOver: action.matchOver ?? false,
        // Accumulate completed game's turn history for match-level analysis
        matchTurnHistory: [...state.matchTurnHistory, finalTurnHistory],
      };
    }
    case "NEXT_GAME": {
      // Compute myColor from new game's player assignments (colors swap each game)
      const nextMyColor: Player | null = action.myAddress
        ? (action.white === action.myAddress ? "white" : "black")
        : state.myColor;
      return {
        ...state,
        gameId: action.gameId,
        gameState: action.gameState,
        matchState: action.matchState,
        myColor: nextMyColor,
        status: "playing",
        winner: null,
        resultType: null,
        legalMoves: [],
        undoCount: 0,
        turnStartedAt: null,
        lastOpponentMove: null,
        pendingConfirmation: false,
        doubleOffered: false,
        doubleOfferedBy: null,
        turnHistory: [],
        currentTurnPlayer: null,
        currentTurnDice: null,
        currentTurnMoves: [],
        turnStartBoard: null,
        matchOver: false,
        // Preserve matchTurnHistory across games
      };
    }
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
        doubleDepositRequired: false,
      };
    case "DOUBLE_AWAITING_DEPOSITS":
      return {
        ...state,
        doubleOffered: false,
        doubleOfferedBy: null,
        doubleDepositRequired: true,
        doubleDepositAmount: action.additionalDeposit,
        doubleDepositNewCubeValue: action.newCubeValue,
        doubleDepositDoubler: action.doubler,
        doubleDepositResponder: action.responder,
        doubleDepositDoublerDone: false,
        doubleDepositResponderDone: false,
        doubleDepositComplete: false,
      };
    case "DOUBLE_DEPOSIT_RECEIVED":
      return {
        ...state,
        doubleDepositDoublerDone: action.player === state.doubleDepositDoubler ? true : state.doubleDepositDoublerDone,
        doubleDepositResponderDone: action.player === state.doubleDepositResponder ? true : state.doubleDepositResponderDone,
      };
    case "DOUBLE_DEPOSITS_COMPLETE":
      return {
        ...state,
        doubleDepositRequired: false,
        doubleDepositComplete: true,
        doubleDepositDoublerDone: true,
        doubleDepositResponderDone: true,
        gameState: state.gameState
          ? { ...state.gameState, cubeValue: action.newCubeValue, cubeOwner: action.cubeOwner }
          : state.gameState,
      };
    case "DOUBLE_DEPOSIT_TIMEOUT":
      return {
        ...state,
        doubleDepositRequired: false,
        doubleDepositComplete: false,
        doubleDepositDoubler: null,
        doubleDepositResponder: null,
        doubleDepositDoublerDone: false,
        doubleDepositResponderDone: false,
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
    case "LOCAL_MOVE":
      return {
        ...state,
        bufferedMoves: [...state.bufferedMoves, { from: action.from, to: action.to }],
        localGameState: action.newState,
        localLegalMoves: action.legalMoves,
        currentTurnMoves: [...state.currentTurnMoves, { from: action.from, to: action.to, die: action.die }],
      };
    case "LOCAL_UNDO": {
      if (state.bufferedMoves.length === 0 || !state.gameState) return state;
      // Replay all buffered moves except the last one from server state
      const remaining = state.bufferedMoves.slice(0, -1);
      let replayState: GameState = state.gameState;
      for (const m of remaining) {
        const next = coreMakeMove(replayState, m.from, m.to);
        if (next) replayState = next;
      }
      const replayLegal = replayState.movesRemaining.length > 0
        ? getLegalFirstMoves(replayState.board, replayState.currentPlayer, replayState.movesRemaining)
        : [];
      return {
        ...state,
        bufferedMoves: remaining,
        localGameState: remaining.length > 0 ? replayState : null,
        localLegalMoves: remaining.length > 0 ? replayLegal : state.legalMoves,
        currentTurnMoves: state.currentTurnMoves.slice(0, -1),
      };
    }
    case "CLEAR_BUFFER":
      return {
        ...state,
        bufferedMoves: [],
        localGameState: null,
        localLegalMoves: [],
        // Reset currentTurnMoves so server MOVE_MADE responses re-populate without duplicates
        currentTurnMoves: [],
      };
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
  // Track whether we're flushing buffered moves to server
  const flushingRef = useRef(false);

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
          matchState: msg.match_state as MatchState | undefined,
          turnTimeLimit: msg.turn_time_limit as number | undefined,
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
        // During flush, suppress our own move_made echoes (server state updates silently)
        if (flushingRef.current && player === myColorRef.current) {
          // Still update server state silently for consistency
          dispatch({
            type: "MOVE_MADE",
            gameState: gs,
            legalMoves: (msg.legal_moves || []) as Move[],
            player,
            move,
            needsConfirmation: msg.needs_confirmation as boolean | undefined,
          });
          return;
        }
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
        flushingRef.current = false;
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
          matchState: msg.match_state as MatchState | undefined,
          matchOver: msg.match_over as boolean | undefined,
        });
      }),
      on("next_game", (msg) => {
        dispatch({
          type: "NEXT_GAME",
          gameId: msg.game_id as string,
          gameState: msg.game_state as GameState,
          matchState: msg.match_state as MatchState,
          myAddress: addressRef.current || "",
          white: msg.white as string,
          black: msg.black as string,
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
      on("double_awaiting_deposits", (msg) =>
        dispatch({
          type: "DOUBLE_AWAITING_DEPOSITS",
          newCubeValue: msg.new_cube_value as number,
          additionalDeposit: msg.additional_deposit as string,
          doubler: msg.doubler as string,
          responder: msg.responder as string,
        })
      ),
      on("double_deposit_received", (msg) =>
        dispatch({
          type: "DOUBLE_DEPOSIT_RECEIVED",
          player: msg.player as string,
          depositsComplete: msg.deposits_complete as boolean,
        })
      ),
      on("double_deposits_complete", (msg) =>
        dispatch({
          type: "DOUBLE_DEPOSITS_COMPLETE",
          newCubeValue: msg.new_cube_value as number,
          cubeOwner: msg.cube_owner as Player,
        })
      ),
      on("double_deposit_timeout", () =>
        dispatch({ type: "DOUBLE_DEPOSIT_TIMEOUT" })
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
      const timer = setTimeout(() => dispatch({ type: "CLEAR_LAST_MOVE" }), CLEAR_LAST_MOVE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [state.lastOpponentMove]);

  // Clear incoming reaction after 3 seconds
  useEffect(() => {
    if (state.lastReaction) {
      const timer = setTimeout(() => dispatch({ type: "CLEAR_REACTION" }), CLEAR_REACTION_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [state.lastReaction]);

  // No forced move auto-play — player always confirms manually

  const createGame = useCallback(
    (wagerAmount: number, matchLength?: number, timeControl?: number) => {
      sendMessage({
        type: "create_game",
        wager_amount: wagerAmount,
        match_length: matchLength,
        time_control: timeControl,
      });
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
    (wagerAmount: number, matchLength: number = 1) => {
      sendMessage({ type: "join_queue", wager_amount: wagerAmount, match_length: matchLength });
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
      if (!state.gameId) return;
      // Buffer locally: validate with core lib, don't send to server
      const currentState = stateRef.current.localGameState || stateRef.current.gameState;
      if (!currentState) return;
      const newState = coreMakeMove(currentState, from, to);
      if (!newState) return; // invalid move
      // Determine which die was used by comparing movesRemaining
      const oldMoves = [...currentState.movesRemaining];
      const newMoves = [...newState.movesRemaining];
      let die = oldMoves[0] || 0;
      for (const d of oldMoves) {
        const idx = newMoves.indexOf(d);
        if (idx === -1) { die = d; break; }
        newMoves.splice(idx, 1);
      }
      const legalMoves = newState.movesRemaining.length > 0
        ? getLegalFirstMoves(newState.board, newState.currentPlayer, newState.movesRemaining)
        : [];
      dispatch({ type: "LOCAL_MOVE", from, to, die, newState, legalMoves });
    },
    [state.gameId]
  );

  const endTurn = useCallback(() => {
    if (!state.gameId) return;
    const moves = stateRef.current.bufferedMoves;
    if (moves.length > 0) {
      // Flush all buffered moves to the server, then end turn
      flushingRef.current = true;
      for (const m of moves) {
        sendMessage({ type: "move", game_id: state.gameId!, from: m.from, to: m.to });
      }
      sendMessage({ type: "end_turn", game_id: state.gameId! });
      dispatch({ type: "CLEAR_BUFFER" });
      // flushingRef will be cleared when turn_ended arrives
    } else {
      sendMessage({ type: "end_turn", game_id: state.gameId });
    }
  }, [sendMessage, state.gameId]);

  const undoMove = useCallback(() => {
    if (!state.gameId) return;
    if (stateRef.current.bufferedMoves.length > 0) {
      // Undo locally — no server call needed
      dispatch({ type: "LOCAL_UNDO" });
    } else {
      sendMessage({ type: "undo_move", game_id: state.gameId });
    }
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

  /** Submit on-chain double deposit, then notify server */
  const submitDoubleDeposit = useCallback(async () => {
    if (!state.gameId || !abstraxionClient || !state.doubleDepositRequired) return;
    const escrowContract = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;
    const denom = process.env.NEXT_PUBLIC_GAMMON_DENOM || USDC_DENOM;
    if (!escrowContract) {
      console.error("[useGame] NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS not set");
      return;
    }
    try {
      const amount = state.doubleDepositAmount;
      await abstraxionClient.execute(
        addressRef.current!,
        escrowContract,
        { double_deposit: { game_id: state.gameId } },
        "auto",
        undefined,
        [{ denom, amount }],
      );
      // Notify server that deposit was made
      sendMessage({ type: "double_deposit_confirmed", game_id: state.gameId });
    } catch (err) {
      console.error("[useGame] Double deposit failed:", err);
      dispatch({ type: "ERROR", message: "Double deposit transaction failed" });
    }
  }, [state.gameId, state.doubleDepositRequired, state.doubleDepositAmount, abstraxionClient, sendMessage]);

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

  // Expose local state when buffer is active
  const hasBuffer = state.bufferedMoves.length > 0;
  const effectiveGameState = hasBuffer ? state.localGameState : state.gameState;
  const effectiveLegalMoves = hasBuffer ? state.localLegalMoves : state.legalMoves;
  const bufferPendingConfirmation = hasBuffer && state.localLegalMoves.length === 0;

  return {
    ...state,
    gameState: effectiveGameState,
    legalMoves: effectiveLegalMoves,
    turnHistory: state.turnHistory,
    matchTurnHistory: state.matchTurnHistory,
    canUndo: hasBuffer || state.undoCount > 0 || state.pendingConfirmation,
    pendingConfirmation: bufferPendingConfirmation || state.pendingConfirmation,
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
    submitDoubleDeposit,
    sendReaction,
    reset,
  };
}
