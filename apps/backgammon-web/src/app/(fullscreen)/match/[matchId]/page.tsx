"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/hooks/useGame";
import { useSocial } from "@/hooks/useSocial";
import { GameScreen } from "@/components/GameScreen";
import { useAuth } from "@/hooks/useAuth";
import { WS_URL } from "@/lib/ws-config";

export default function MatchPage() {
  const router = useRouter();
  const { address, isConnected, isConnecting } = useAuth();

  useEffect(() => {
    if (!isConnecting && !isConnected) {
      router.replace("/login");
    }
  }, [isConnected, isConnecting, router]);

  const {
    gameState,
    myColor,
    legalMoves,
    opponent,
    opponentDisconnected,
    winner,
    resultType,
    connected,
    canUndo,
    turnStartedAt,
    lastOpponentMove,
    lastReaction,
    pendingConfirmation,
    forcedMoveNotice,
    disconnectCountdown,
    makeMove,
    rollDice,
    endTurn,
    undoMove,
    resign,
    sendReaction,
    reset,
  } = useGame(WS_URL, address);

  const { blockUser, reportUser } = useSocial(WS_URL, address);

  // Loading state: waiting for server to send game state
  if (!gameState || !myColor) {
    return (
      <div
        style={{
          height: "100vh",
          background: "var(--color-bg-deepest)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
          color: "var(--color-text-primary)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--color-bg-subtle)",
            borderTopColor: "var(--color-gold-primary)",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
          {connected ? "Loading game..." : "Connecting..."}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <GameScreen
      gameState={gameState}
      myColor={myColor}
      legalMoves={legalMoves}
      opponent={opponent}
      opponentDisconnected={opponentDisconnected}
      winner={winner}
      resultType={resultType}
      onMove={makeMove}
      onRollDice={rollDice}
      onEndTurn={endTurn}
      onResign={resign}
      onUndo={undoMove}
      canUndo={canUndo}
      turnStartedAt={turnStartedAt}
      lastOpponentMove={lastOpponentMove}
      pendingConfirmation={pendingConfirmation}
      forcedMoveNotice={forcedMoveNotice}
      disconnectCountdown={disconnectCountdown}
      onSendReaction={sendReaction}
      lastReaction={lastReaction}
      onBlockPlayer={blockUser}
      onReportPlayer={reportUser}
      opponentAddress={opponent}
      onNewGame={() => {
        reset();
        router.push("/matchmaking");
      }}
      onBackToLobby={() => {
        reset();
        router.push("/");
      }}
    />
  );
}
