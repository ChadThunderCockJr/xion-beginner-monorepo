"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalGame } from "@/hooks/useLocalGame";
import { GameScreen } from "@/components/GameScreen";
import type { AIDifficulty } from "@/lib/ai";

const VALID_DIFFICULTIES = new Set<AIDifficulty>([
  "beginner",
  "club",
  "expert",
  "gm",
]);

function AIMatchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawDifficulty = searchParams.get("difficulty") ?? "expert";
  const difficulty: AIDifficulty = VALID_DIFFICULTIES.has(
    rawDifficulty as AIDifficulty
  )
    ? (rawDifficulty as AIDifficulty)
    : "expert";

  const {
    gameState,
    myColor,
    legalMoves,
    opponent,
    opponentDisconnected,
    winner,
    resultType,
    canUndo,
    turnStartedAt,
    lastOpponentMove,
    cubeValue,
    cubeOwner,
    doubleOffered,
    doubleOfferedBy,
    canDouble,
    forcedMoveNotice,
    turnHistory,
    rollDice,
    makeMove,
    endTurn,
    undoMove,
    resign,
    reset,
    offerDouble,
    acceptDouble,
    rejectDouble,
  } = useLocalGame(difficulty);

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
      turnStartedAt={null}
      lastOpponentMove={lastOpponentMove}
      onNewGame={reset}
      onBackToLobby={() => {
        reset();
        router.push("/");
      }}
      cubeValue={cubeValue}
      cubeOwner={cubeOwner}
      doubleOffered={doubleOffered}
      doubleOfferedBy={doubleOfferedBy}
      canDouble={canDouble}
      onDouble={offerDouble}
      onAcceptDouble={acceptDouble}
      onRejectDouble={rejectDouble}
      forcedMoveNotice={forcedMoveNotice}
      turnHistory={turnHistory}
    />
  );
}

export default function AIMatchPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: "100vh",
            background: "var(--color-bg-deepest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-secondary)",
            fontSize: "0.875rem",
          }}
        >
          Loading...
        </div>
      }
    >
      <AIMatchInner />
    </Suspense>
  );
}
