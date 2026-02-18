"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameState, Player, Move } from "@xion-beginner/backgammon-core";
import { getPipCount } from "@xion-beginner/backgammon-core";
import { Board, Die, DoublingCube } from "./Board";
import { PostGameAnalysis } from "./PostGameAnalysis";
import type { TurnRecord } from "@/hooks/useLocalGame";

interface GameScreenProps {
  gameState: GameState;
  myColor: Player;
  legalMoves: Move[];
  opponent: string | null;
  opponentDisconnected: boolean;
  winner: Player | null;
  resultType: string | null;
  onMove: (from: number, to: number) => void;
  onRollDice: () => void;
  onEndTurn: () => void;
  onResign: () => void;
  onNewGame: () => void;
  onBackToLobby?: () => void;
  onUndo: () => void;
  canUndo: boolean;
  turnStartedAt: number | null;
  lastOpponentMove: { from: number; to: number } | null;
  cubeValue?: number;
  cubeOwner?: Player | null;
  doubleOffered?: boolean;
  doubleOfferedBy?: Player | null;
  canDouble?: boolean;
  onDouble?: () => void;
  onAcceptDouble?: () => void;
  onRejectDouble?: () => void;
  forcedMoveNotice?: boolean;
  turnHistory?: TurnRecord[];
  pendingConfirmation?: boolean;
  disconnectCountdown?: number | null;
}

const TURN_TIME_LIMIT = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── PlayerBar (redesigned) ────────────────────────────────────

function PlayerBar({
  name,
  color,
  isActive,
  timer,
  isDisconnected,
  isMe,
}: {
  name: string;
  color: Player;
  isActive: boolean;
  timer: number | null;
  isDisconnected?: boolean;
  isMe: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg transition-colors px-2 py-1 sm:px-4 sm:py-2"
      style={{
        background: isActive ? "var(--color-bg-elevated)" : "transparent",
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* Checker color indicator */}
        <div
          className="w-5 h-5 sm:w-7 sm:h-7"
          style={{
            borderRadius: "50%",
            background: color === "white" ? "var(--color-text-primary)" : "#6E1A30",
            border: `2px solid ${color === "white" ? "var(--color-text-secondary)" : "var(--color-burgundy-deep)"}`,
          }}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isMe ? "You" : name}
          </span>
          {isDisconnected && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="2"
              className="opacity-80"
            >
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
            </svg>
          )}
        </div>
      </div>

      {/* Clock */}
      {timer !== null && (
        <div
          className="font-mono tabular-nums text-center text-sm sm:text-[17px] px-2 py-1 sm:px-3 sm:py-1.5"
          style={{
            borderRadius: 5,
            background: isActive ? "var(--color-bg-deepest)" : "var(--color-bg-surface)",
            border: "1px solid var(--color-bg-subtle)",
            fontWeight: 700,
            color: isActive
              ? timer <= 10
                ? "var(--color-danger)"
                : timer <= 30
                  ? "var(--color-warning)"
                  : "var(--color-text-primary)"
              : "var(--color-text-muted)",
            letterSpacing: "0.04em",
            minWidth: 64,
          }}
        >
          {formatTime(timer)}
        </div>
      )}
    </div>
  );
}

// ─── Top Nav Header ────────────────────────────────────────────

function TopNav({
  onBack,
  onMenuToggle,
}: {
  onBack?: () => void;
  onMenuToggle: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between shrink-0 px-2 py-1 sm:px-4 sm:py-1.5"
      style={{
        borderBottom: "1px solid var(--color-bg-subtle)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <button
          onClick={onBack}
          className="text-[var(--color-text-muted)] cursor-pointer text-base"
          style={{ background: "none", border: "none", padding: "10px 12px" }}
        >
          ←
        </button>
        <span className="text-xs font-semibold text-[var(--color-text-muted)]">
          Rated · 5pt
        </span>
      </div>

      {/* Match Score */}
      <div
        className="flex items-center gap-2"
        style={{
          padding: "3px 12px",
          background: "var(--color-bg-surface)",
          borderRadius: 5,
          border: "1px solid var(--color-bg-subtle)",
        }}
      >
        <span className="text-[15px] font-bold text-[var(--color-text-primary)]">0</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">–</span>
        <span className="text-[15px] font-bold text-[var(--color-text-primary)]">0</span>
        <span className="text-[9px] text-[var(--color-text-muted)] ml-0.5">/ 5</span>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-1 cursor-pointer"
          style={{ padding: "3px 8px", fontSize: 9, color: "var(--color-gold-dark)" }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--color-gold-dark)" strokeWidth="1.5">
            <path d="M8 1.5L3 4v3c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5V4L8 1.5z" />
            <path d="M6 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Fair
        </div>
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center cursor-pointer transition-colors"
          style={{
            width: 44,
            height: 44,
            borderRadius: 7,
            border: "1px solid var(--color-bg-subtle)",
            background: "transparent",
            color: "var(--color-text-muted)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4h10M3 8h10M3 12h10" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

// ─── Slide-out Menu ────────────────────────────────────────────

function SlideOutMenu({
  onClose,
  onResign,
  onDouble,
  canDouble,
}: {
  onClose: () => void;
  onResign: () => void;
  onDouble?: () => void;
  canDouble?: boolean;
}) {
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const menuItems = [
    { label: "Offer Double", action: () => { if (canDouble && onDouble) { onDouble(); onClose(); } }, disabled: !canDouble },
    { label: "Resign", action: () => setShowResignConfirm(true), danger: true },
    { label: "Offer Draw", action: () => {} },
    { type: "separator" as const },
    { label: "Move List", action: () => {} },
    { label: "Match Info", action: () => {} },
    { label: "Verify Dice", action: () => {} },
    { type: "separator" as const },
    { label: "Board Theme", action: () => {} },
    { label: "Sound", action: () => {} },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="absolute top-0 right-0 z-50 flex flex-col animate-slide-in-right"
        style={{
          width: 200,
          height: "100%",
          background: "var(--color-bg-surface)",
          borderLeft: "1px solid var(--color-bg-subtle)",
          padding: "16px 14px",
          gap: 3,
          boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[13px] font-bold text-[var(--color-text-primary)]">Menu</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 15 }}
          >
            ✕
          </button>
        </div>

        {menuItems.map((item, i) =>
          "type" in item && item.type === "separator" ? (
            <div key={i} style={{ height: 1, background: "var(--color-bg-subtle)", margin: "5px 0" }} />
          ) : (
            <button
              key={i}
              onClick={"action" in item ? item.action : undefined}
              disabled={"disabled" in item && !!item.disabled}
              className="text-left transition-colors hover:bg-[var(--color-bg-elevated)]"
              style={{
                padding: "7px 10px",
                borderRadius: 5,
                border: "none",
                background: "transparent",
                color: "danger" in item && item.danger ? "var(--color-danger)" : "disabled" in item && item.disabled ? "var(--color-text-faint)" : "var(--color-text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "disabled" in item && item.disabled ? "not-allowed" : "pointer",
                opacity: "disabled" in item && item.disabled ? 0.5 : 1,
              }}
            >
              {"label" in item ? item.label : ""}
            </button>
          )
        )}
      </div>

      {/* Resign confirmation modal */}
      {showResignConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowResignConfirm(false)}
        >
          <div className="panel p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Resign Game?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">
              This counts as a loss. Are you sure you want to resign?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResignConfirm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResignConfirm(false);
                  onResign();
                  onClose();
                }}
                className="btn-danger flex-1"
              >
                Resign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Center Controls (rendered inside Board center strip) ──────

function CenterControls({
  dice,
  movesRemaining,
  needsToRoll,
  canEndTurn,
  canUndo,
  isMyTurn,
  gameOver,
  onRollDice,
  onEndTurn,
  onUndo,
  cubeValue = 64,
  canDouble,
  onDouble,
  doubleOffered,
  doubleOfferedBy,
  myColor,
  currentPlayer,
  onAcceptDouble,
  onRejectDouble,
  forcedMoveNotice,
  activeDieIndex,
  onDieClick,
}: {
  dice: [number, number] | null;
  movesRemaining: number[];
  needsToRoll: boolean;
  canEndTurn: boolean;
  canUndo: boolean;
  isMyTurn: boolean;
  gameOver: boolean;
  onRollDice: () => void;
  onEndTurn: () => void;
  onUndo: () => void;
  cubeValue?: number;
  canDouble?: boolean;
  onDouble?: () => void;
  doubleOffered?: boolean;
  doubleOfferedBy?: Player | null;
  myColor?: Player;
  currentPlayer?: Player;
  onAcceptDouble?: () => void;
  onRejectDouble?: () => void;
  forcedMoveNotice?: boolean;
  activeDieIndex?: 0 | 1 | null;
  onDieClick?: (index: number) => void;
}) {
  if (gameOver) return null;

  // Show accept/reject prompt when opponent has offered a double
  if (doubleOffered && doubleOfferedBy && myColor && doubleOfferedBy !== myColor) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ gap: 10 }}>
        <span className="text-sm font-bold text-[var(--color-gold-primary)]">
          Opponent doubles to {cubeValue * 2}!
        </span>
        <div className="flex" style={{ gap: 8 }}>
          <button
            onClick={onAcceptDouble}
            className="cursor-pointer"
            style={{
              padding: "8px 20px",
              borderRadius: 5,
              border: "none",
              background: "linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-primary))",
              color: "var(--color-accent-fg)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Accept
          </button>
          <button
            onClick={onRejectDouble}
            className="cursor-pointer"
            style={{
              padding: "8px 20px",
              borderRadius: 5,
              border: "1px solid var(--color-bg-subtle)",
              background: "var(--color-bg-elevated)",
              color: "var(--color-danger)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  // Show "Waiting for response..." when human offered a double
  if (doubleOffered && doubleOfferedBy && myColor && doubleOfferedBy === myColor) {
    return (
      <div className="flex items-center justify-center" style={{ gap: 16 }}>
        <DoublingCube value={cubeValue} />
        <span className="text-xs text-[var(--color-text-faint)]">Waiting for response...</span>
      </div>
    );
  }

  function getDiceList(): { value: number; used: boolean }[] {
    if (!dice) return [];
    if (dice[0] === dice[1]) {
      const rem = movesRemaining.length;
      return Array.from({ length: 4 }, (_, i) => ({ value: dice[0], used: i >= rem }));
    }
    return dice.map((v) => ({
      value: v,
      used: !movesRemaining.includes(v),
    }));
  }

  const diceList = getDiceList();

  return (
    <div className="flex flex-col items-center justify-center" style={{ gap: 4 }}>
      {forcedMoveNotice && (
        <span
          className="text-[10px] font-semibold animate-fade-in"
          style={{ color: "var(--color-text-muted)", letterSpacing: "0.05em" }}
        >
          Forced move
        </span>
      )}
      <div className="flex items-center justify-center" style={{ gap: 16 }}>
      <DoublingCube value={cubeValue} />

      {needsToRoll ? (
        <div className="flex" style={{ gap: 8 }}>
          {canDouble && onDouble && (
            <button
              onClick={onDouble}
              className="cursor-pointer"
              style={{
                padding: "8px 18px",
                borderRadius: 5,
                border: "1.5px solid var(--color-gold-dark)",
                background: "var(--color-bg-elevated)",
                color: "var(--color-gold-primary)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Double
            </button>
          )}
          <button
            onClick={onRollDice}
            className="btn-primary"
            style={{ padding: "8px 24px", fontSize: 13, fontWeight: 700 }}
          >
            Roll Dice
          </button>
        </div>
      ) : diceList.length > 0 ? (
        <div className="flex" style={{ gap: 8 }}>
          {diceList.map((d, i) => {
            const isDoubles = dice && dice[0] === dice[1];
            const canClick = isMyTurn && !isDoubles && !d.used && onDieClick;
            const isActive = activeDieIndex === i;
            return (
              <div
                key={i}
                onClick={canClick ? () => onDieClick!(i) : undefined}
                style={{
                  cursor: canClick ? "pointer" : "default",
                  borderRadius: 10,
                  border: isActive ? "2px solid var(--color-gold-primary)" : "2px solid transparent",
                  boxShadow: isActive ? "0 0 8px rgba(88,20,40,0.4)" : "none",
                  transition: "border-color 150ms, box-shadow 150ms",
                }}
              >
                <Die value={d.value} used={d.used} player={currentPlayer} />
              </div>
            );
          })}
        </div>
      ) : !isMyTurn ? (
        <span className="text-xs text-[var(--color-text-faint)]">Waiting...</span>
      ) : null}

      {isMyTurn && dice && (
        <div className="flex" style={{ gap: 5 }}>
          {canUndo && (
            <button
              onClick={onUndo}
              className="cursor-pointer transition-colors"
              style={{
                padding: "10px 14px",
                borderRadius: 5,
                border: "1px solid var(--color-bg-subtle)",
                background: "var(--color-bg-elevated)",
                color: "var(--color-text-secondary)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Undo
            </button>
          )}
          {canEndTurn && (
            <button
              onClick={onEndTurn}
              className="cursor-pointer"
              style={{
                padding: "10px 14px",
                borderRadius: 5,
                border: "none",
                background: "linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-primary))",
                color: "var(--color-accent-fg)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Confirm
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// ─── GameScreen ────────────────────────────────────────────────

export function GameScreen({
  gameState,
  myColor,
  legalMoves,
  opponent,
  opponentDisconnected,
  winner,
  resultType,
  onMove,
  onRollDice,
  onEndTurn,
  onResign,
  onNewGame,
  onBackToLobby,
  onUndo,
  canUndo,
  turnStartedAt,
  lastOpponentMove,
  cubeValue = 1,
  cubeOwner,
  doubleOffered = false,
  doubleOfferedBy,
  canDouble = false,
  onDouble,
  onAcceptDouble,
  onRejectDouble,
  forcedMoveNotice = false,
  turnHistory,
  pendingConfirmation = false,
  disconnectCountdown,
}: GameScreenProps) {
  const isMyTurn = gameState.currentPlayer === myColor;
  const opponentColor: Player = myColor === "white" ? "black" : "white";
  const myPips = getPipCount(gameState.board, myColor);
  const opponentPips = getPipCount(gameState.board, opponentColor);

  const needsToRoll = isMyTurn && gameState.dice === null && !gameState.gameOver && !doubleOffered;
  const canEndTurn =
    pendingConfirmation ||
    (isMyTurn &&
    gameState.dice !== null &&
    legalMoves.length === 0 &&
    gameState.movesRemaining.length === 0 &&
    !gameState.gameOver);

  // Dice swap state
  const [activeDieIndex, setActiveDieIndex] = useState<0 | 1 | null>(null);

  // Reset active die on new dice roll
  useEffect(() => {
    setActiveDieIndex(null);
  }, [gameState.dice?.[0], gameState.dice?.[1]]);

  // Turn timer
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT);
  useEffect(() => {
    if (!turnStartedAt || gameState.gameOver) {
      setTimeLeft(TURN_TIME_LIMIT);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - turnStartedAt) / 1000);
      setTimeLeft(Math.max(0, TURN_TIME_LIMIT - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [turnStartedAt, gameState.gameOver]);

  const [showMenu, setShowMenu] = useState(false);
  const [showPostGame, setShowPostGame] = useState(false);

  // Reset post-game view when a new game starts
  useEffect(() => {
    if (!gameState.gameOver) {
      setShowPostGame(false);
    }
  }, [gameState.gameOver]);

  const handleResign = useCallback(() => {
    onResign();
  }, [onResign]);

  const resultLabel =
    resultType === "backgammon"
      ? "Backgammon!"
      : resultType === "gammon"
        ? "Gammon!"
        : "Normal";

  const centerControls = (
    <CenterControls
      dice={gameState.dice}
      movesRemaining={gameState.movesRemaining}
      needsToRoll={needsToRoll}
      canEndTurn={canEndTurn}
      canUndo={canUndo}
      isMyTurn={isMyTurn || pendingConfirmation}
      gameOver={gameState.gameOver}
      onRollDice={onRollDice}
      onEndTurn={onEndTurn}
      onUndo={onUndo}
      cubeValue={cubeValue}
      canDouble={canDouble}
      onDouble={onDouble}
      doubleOffered={doubleOffered}
      doubleOfferedBy={doubleOfferedBy}
      myColor={myColor}
      currentPlayer={gameState.currentPlayer}
      onAcceptDouble={onAcceptDouble}
      onRejectDouble={onRejectDouble}
      forcedMoveNotice={forcedMoveNotice}
      activeDieIndex={activeDieIndex}
      onDieClick={(i) => setActiveDieIndex(activeDieIndex === i ? null : (i as 0 | 1))}
    />
  );

  // When showPostGame is active, render PostGameAnalysis full-screen
  if (gameState.gameOver && showPostGame) {
    return (
      <PostGameAnalysis
        winner={winner}
        myColor={myColor}
        resultType={resultType}
        opponentName={opponent || "AI"}
        cubeValue={cubeValue}
        turnHistory={turnHistory}
        onRematch={onNewGame}
        onBackToLobby={onBackToLobby ?? onNewGame}
        onBack={() => setShowPostGame(false)}
      />
    );
  }

  return (
    <div
      className="h-dvh flex flex-col w-full overflow-hidden"
      style={{ fontFamily: "var(--font-body)", color: "var(--color-text-primary)", userSelect: "none" }}
    >
      {/* Top Nav Header */}
      <TopNav
        onBack={onBackToLobby}
        onMenuToggle={() => setShowMenu(!showMenu)}
      />

      {/* Game Area */}
      <main className="flex-1 min-h-0 flex flex-col items-center relative px-0 sm:px-2 md:px-4" style={{ paddingTop: 2, paddingBottom: 2, gap: 2 }}>
        {/* Opponent bar */}
        <div className="w-full max-w-[960px]">
          <PlayerBar
            name={opponent || "Opponent"}
            color={opponentColor}
            isActive={!isMyTurn && !gameState.gameOver}
            timer={!isMyTurn && !gameState.gameOver && turnStartedAt ? timeLeft : null}
            isDisconnected={opponentDisconnected}
            isMe={false}
          />
        </div>

        {/* Board */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
          <Board
            board={gameState.board}
            myColor={myColor}
            legalMoves={(isMyTurn || pendingConfirmation) ? legalMoves : []}
            isMyTurn={isMyTurn || pendingConfirmation}
            dice={gameState.dice}
            onMove={onMove}
            movesRemaining={gameState.movesRemaining}
            lastOpponentMove={lastOpponentMove}
            gameOver={gameState.gameOver}
            centerControls={centerControls}
            pipCounts={[opponentPips, myPips]}
            activeDieIndex={activeDieIndex}
          />
        </div>

        {/* Player bar */}
        <div className="w-full max-w-[960px]">
          <PlayerBar
            name="You"
            color={myColor}
            isActive={isMyTurn && !gameState.gameOver}
            timer={isMyTurn && !gameState.gameOver && turnStartedAt ? timeLeft : null}
            isMe={true}
          />
        </div>

        {/* Disconnect countdown banner */}
        {disconnectCountdown != null && disconnectCountdown > 0 && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-fade-in"
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "rgba(204,68,68,0.9)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
            }}
          >
            Opponent disconnected — forfeiting in {disconnectCountdown}s
          </div>
        )}

        {/* Game over overlay */}
        {gameState.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center animate-fade-in z-30">
            <div
              className={`panel p-6 sm:p-8 text-center max-w-xs mx-4 ${
                winner === myColor
                  ? "border-[rgba(212,168,67,0.3)]"
                  : "border-[rgba(248,113,113,0.25)]"
              }`}
            >
              <h2
                className={`font-display text-[32px] font-semibold mb-1 ${
                  winner === myColor
                    ? "text-[var(--color-gold-primary)]"
                    : "text-[var(--color-danger)]"
                }`}
              >
                {winner === myColor ? "Victory!" : "Defeat"}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                {resultLabel}
                {resultType === "gammon" && " — Double points"}
                {resultType === "backgammon" && " — Triple points"}
              </p>
              <div className="flex flex-col gap-2.5">
                <button onClick={() => setShowPostGame(true)} className="btn-primary w-full">
                  View Analysis
                </button>
                <button onClick={onNewGame} className="btn-secondary w-full">
                  Play Again
                </button>
                <button onClick={onBackToLobby ?? onNewGame} className="btn-secondary w-full">
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slide-out Menu */}
        {showMenu && (
          <SlideOutMenu
            onClose={() => setShowMenu(false)}
            onResign={handleResign}
            onDouble={onDouble}
            canDouble={canDouble}
          />
        )}
      </main>
    </div>
  );
}
