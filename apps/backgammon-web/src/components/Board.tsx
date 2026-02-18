"use client";

import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { BoardState, Player, Move } from "@xion-beginner/backgammon-core";
import { WHITE_BAR, BLACK_BAR } from "@xion-beginner/backgammon-core";

// ─── Types ───────────────────────────────────────────────────────

export interface BoardProps {
  board: BoardState;
  myColor: Player;
  legalMoves: Move[];
  isMyTurn: boolean;
  dice: [number, number] | null;
  onMove: (from: number, to: number) => void;
  movesRemaining: number[];
  lastOpponentMove: { from: number; to: number } | null;
  gameOver: boolean;
  /** Render prop for center strip controls (dice, undo, confirm) */
  centerControls?: ReactNode;
  /** Pip counts: [opponent, player] from the viewing player's perspective */
  pipCounts?: [number, number];
  /** Active die index for dice swap (Phase 5) */
  activeDieIndex?: 0 | 1 | null;
}

// ─── Design constants ────────────────────────────────────────────

const POINT_W = 68;
const POINT_H = 260;
const POINT_GAP = 2;
const CHECKER_SIZE = 52;
const CHECKER_VISIBLE = 42;
const MAX_SHOW = 5;
const BAR_W = 56;
const BEAROFF_W = 54;
const DIE_SIZE = 56;

const DARK_FELT = "#1A2818";
const LIGHT_FELT = "#243020";

// Intrinsic board size (used for scale-to-fit)
const QUAD_W = 6 * POINT_W + 5 * POINT_GAP; // 418
const BOARD_INNER_W = QUAD_W * 2 + BAR_W + 8 + 12; // two quads + bar + margins + padding
const BOARD_TOTAL_W = BOARD_INNER_W + 4 + BEAROFF_W; // + border + bear-off
const BOARD_TOTAL_H = 20 * 2 + POINT_H * 2 + 60 + 8 + 4; // nums + points + center + padding + border

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};

// ─── Sub-components ──────────────────────────────────────────────

function Checker({
  color,
  highlighted = false,
  isGhost = false,
  onClick,
}: {
  color: "white" | "black";
  highlighted?: boolean;
  isGhost?: boolean;
  onClick?: () => void;
}) {
  const isW = color === "white";
  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center shrink-0"
      style={{
        width: CHECKER_SIZE,
        height: CHECKER_SIZE,
        borderRadius: "50%",
        background: isW ? "#DCD8D0" : "#6E1A30",
        border: `${isW ? "2px" : "2.5px"} solid ${
          highlighted
            ? "var(--color-gold-primary)"
            : isW
              ? "#A8A098"
              : "var(--color-burgundy-deep)"
        }`,
        boxShadow: highlighted
          ? "0 0 12px rgba(88,20,40,0.5), 0 1px 3px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.3)",
        opacity: isGhost ? 0.35 : 1,
        cursor: onClick ? "pointer" : "default",
        zIndex: highlighted ? 10 : undefined,
      }}
    />
  );
}

function CheckerStack({
  color,
  count,
  fromTop,
  selectedIdx,
  onClick,
}: {
  color: "white" | "black";
  count: number;
  fromTop: boolean;
  selectedIdx?: number;
  onClick?: () => void;
}) {
  const show = Math.min(count, MAX_SHOW);
  return (
    <div
      className="relative flex items-center"
      style={{
        flexDirection: fromTop ? "column" : "column-reverse",
        zIndex: 2,
        marginTop: fromTop ? 6 : 0,
        marginBottom: fromTop ? 0 : 6,
      }}
    >
      {Array.from({ length: show }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center justify-center"
          style={{
            marginTop: fromTop && i > 0 ? -(CHECKER_SIZE - CHECKER_VISIBLE) : 0,
            marginBottom: !fromTop && i > 0 ? -(CHECKER_SIZE - CHECKER_VISIBLE) : 0,
            zIndex: fromTop ? show - i : i,
          }}
        >
          <Checker
            color={color}
            highlighted={selectedIdx === i}
            onClick={onClick}
          />
          {count > MAX_SHOW && i === (fromTop ? show - 1 : 0) && (
            <span
              className="absolute text-[13px] font-bold"
              style={{
                color: color === "white" ? "var(--color-bg-deepest)" : "var(--color-text-primary)",
              }}
            >
              {count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Die({ value, used = false, player }: { value: number; used?: boolean; player?: "white" | "black" }) {
  const dots = DICE_DOTS[value] || [];
  const r = DIE_SIZE * 0.08;
  const isBlack = player === "black";
  const faceFill = isBlack ? "#6E1A30" : "#DCD8D0";
  const faceStroke = isBlack ? "#8A2840" : "#B8B4AC";
  const dotFill = isBlack ? "#DCD8D0" : "#2A2018";
  return (
    <svg
      width={DIE_SIZE}
      height={DIE_SIZE}
      viewBox={`0 0 ${DIE_SIZE} ${DIE_SIZE}`}
      className={used ? "" : "animate-dice"}
      style={{ opacity: used ? 0.2 : 1 }}
    >
      <rect
        x="1" y="1"
        width={DIE_SIZE - 2} height={DIE_SIZE - 2}
        rx={DIE_SIZE * 0.16}
        fill={faceFill}
        stroke={faceStroke}
        strokeWidth="1"
      />
      {dots.map(([px, py], i) => (
        <circle
          key={i}
          cx={px * DIE_SIZE}
          cy={py * DIE_SIZE}
          r={r}
          fill={used ? "#999" : dotFill}
        />
      ))}
    </svg>
  );
}

export function DoublingCube({ value = 64 }: { value?: number }) {
  return (
    <div
      className="flex items-center justify-center text-[13px] font-bold"
      style={{
        width: 36,
        height: 36,
        borderRadius: 5,
        background: "var(--color-gold-muted)",
        border: "1.5px solid var(--color-gold-dark)",
        color: "var(--color-accent-fg)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}
    >
      {value}
    </div>
  );
}

// Exported for use in GameScreen center controls
export { Die };

// ─── Main Board Component ────────────────────────────────────────

export function Board({
  board,
  myColor,
  legalMoves,
  isMyTurn,
  dice,
  onMove,
  movesRemaining,
  lastOpponentMove,
  gameOver,
  centerControls,
  pipCounts,
  activeDieIndex,
}: BoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const flipped = myColor === "black";
  const repeatDestRef = useRef<number | null>(null);

  // ─── Animation state ──────────────────────────────────────────
  const boardInnerRef = useRef<HTMLDivElement>(null);
  const [animatingMove, setAnimatingMove] = useState<{
    fromX: number; fromY: number;
    toX: number; toY: number;
    color: "white" | "black";
    sourcePoint: number;
    destPoint: number;
    isPlayerMove: boolean;
  } | null>(null);

  // ─── Drag state ───────────────────────────────────────────────
  const [dragState, setDragState] = useState<{
    sourcePoint: number;
    color: "white" | "black";
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragOccurredRef = useRef(false);

  const legalDests = useMemo(() => {
    if (selectedPoint === null) return new Set<number>();
    return new Set(legalMoves.filter((m) => m.from === selectedPoint).map((m) => m.to));
  }, [selectedPoint, legalMoves]);

  const legalSources = useMemo(
    () => new Set(legalMoves.map((m) => m.from)),
    [legalMoves]
  );

  const lastMoveFrom = lastOpponentMove?.from ?? null;
  const lastMoveTo = lastOpponentMove?.to ?? null;

  // ─── Point position measurement ───────────────────────────────
  const getPointCenter = useCallback((point: number): { x: number; y: number } | null => {
    const boardEl = boardInnerRef.current;
    if (!boardEl) return null;
    const boardRect = boardEl.getBoundingClientRect();

    if (point === 0 || point === 25) {
      return { x: boardRect.width + 20, y: boardRect.height / 2 };
    }

    const pointEl = boardEl.querySelector(`[data-point="${point}"]`) as HTMLElement | null;
    if (!pointEl) return null;
    const pointRect = pointEl.getBoundingClientRect();
    const isTopHalf = pointRect.top - boardRect.top < boardRect.height / 2;

    return {
      x: pointRect.left + pointRect.width / 2 - boardRect.left,
      y: isTopHalf
        ? pointRect.top + 40 - boardRect.top
        : pointRect.bottom - 40 - boardRect.top,
    };
  }, []);

  // ─── Auto-repeat: after legalMoves update, auto-play next move to same dest
  useEffect(() => {
    const dest = repeatDestRef.current;
    if (dest === null || !isMyTurn) {
      repeatDestRef.current = null;
      return;
    }
    let move = legalMoves.find((m) => m.to === dest);
    if (activeDieIndex != null && dice && move) {
      const preferredValue = dice[activeDieIndex];
      const preferred = legalMoves.find((m) => m.to === dest && m.die === preferredValue);
      if (preferred) move = preferred;
    }
    if (move) {
      onMove(move.from, move.to);
    } else {
      repeatDestRef.current = null;
    }
  }, [legalMoves, isMyTurn, onMove, activeDieIndex, dice]);

  // ─── Opponent move animation ──────────────────────────────────
  useEffect(() => {
    if (lastOpponentMove && !animatingMove) {
      const fromPos = getPointCenter(lastOpponentMove.from);
      const toPos = getPointCenter(lastOpponentMove.to);
      if (fromPos && toPos) {
        const opponentColor: "white" | "black" = myColor === "white" ? "black" : "white";
        setAnimatingMove({
          fromX: fromPos.x, fromY: fromPos.y,
          toX: toPos.x, toY: toPos.y,
          color: opponentColor,
          sourcePoint: lastOpponentMove.from,
          destPoint: lastOpponentMove.to,
          isPlayerMove: false,
        });
        const timer = setTimeout(() => setAnimatingMove(null), 200);
        return () => clearTimeout(timer);
      }
    }
  }, [lastOpponentMove]);

  // ─── Click handlers ──────────────────────────────────────────

  const lastClickRef = useRef<{ point: number; time: number } | null>(null);

  function handleClick(point: number) {
    if (!isMyTurn) return;

    // Skip if drag just occurred
    if (dragOccurredRef.current) {
      dragOccurredRef.current = false;
      return;
    }

    const now = Date.now();
    const last = lastClickRef.current;
    const isRapidRepeat = last !== null && last.point === point && now - last.time < 500;
    lastClickRef.current = { point, time: now };

    // If a source is selected and this is a legal destination → move
    if (selectedPoint !== null) {
      if (legalDests.has(point)) {
        onMove(selectedPoint, point);
        setSelectedPoint(null);
        if (isRapidRepeat) {
          repeatDestRef.current = point;
        }
        return;
      }
      if (point === selectedPoint) {
        setSelectedPoint(null);
        return;
      }
    }

    // Auto-move: if legal moves go TO this point
    const movesTo = legalMoves.filter((m) => m.to === point);
    if (movesTo.length > 0) {
      const uniqueSources = new Set(movesTo.map((m) => m.from));
      // Auto-move when: not a legal source, only one source can reach here, or rapid repeat
      if (!legalSources.has(point) || uniqueSources.size === 1 || isRapidRepeat) {
        let best = movesTo[0];
        if (activeDieIndex != null && dice) {
          const preferredValue = dice[activeDieIndex];
          const preferred = movesTo.find((m) => m.die === preferredValue);
          if (preferred) best = preferred;
        }
        onMove(best.from, point);
        setSelectedPoint(null);
        if (isRapidRepeat) {
          repeatDestRef.current = point;
        }
        return;
      }
    }

    // Select as source
    if (legalSources.has(point)) {
      setSelectedPoint(point);
    }
  }

  function handleBearOff() {
    if (!isMyTurn) return;

    // If a checker is selected and bear-off is a legal dest for it, use that
    if (selectedPoint !== null) {
      const target = legalDests.has(0) ? 0 : legalDests.has(25) ? 25 : null;
      if (target !== null) {
        onMove(selectedPoint, target);
        setSelectedPoint(null);
        repeatDestRef.current = target;
        return;
      }
    }

    // No selection — find any legal bear-off move and auto-execute
    const bearOffMoves = legalMoves.filter((m) => m.to === 0 || m.to === 25);
    if (bearOffMoves.length > 0) {
      let best = bearOffMoves[0];
      if (activeDieIndex != null && dice) {
        const preferredValue = dice[activeDieIndex];
        const preferred = bearOffMoves.find((m) => m.die === preferredValue);
        if (preferred) best = preferred;
      }
      onMove(best.from, best.to);
      setSelectedPoint(null);
      repeatDestRef.current = best.to;
    }
  }

  // ─── Drag-and-drop handlers ───────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMyTurn || gameOver) return;

    const pointEl = (e.target as HTMLElement).closest("[data-point]");
    if (!pointEl) return;
    const point = parseInt(pointEl.getAttribute("data-point")!);
    if (!legalSources.has(point)) return;

    const val = board.points[point];
    const color: "white" | "black" = val > 0 ? "white" : val < 0 ? "black" : myColor;

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    dragOccurredRef.current = false;

    setDragState({ sourcePoint: point, color, cursorX: e.clientX, cursorY: e.clientY });
  }, [isMyTurn, gameOver, legalSources, board.points, myColor]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !dragState) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > 5) {
      isDraggingRef.current = true;
      setSelectedPoint(dragState.sourcePoint);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    if (isDraggingRef.current) {
      setDragState((prev) => (prev ? { ...prev, cursorX: e.clientX, cursorY: e.clientY } : null));
    }
  }, [dragState]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;

    if (isDraggingRef.current && dragState) {
      dragOccurredRef.current = true;

      const boardEl = boardInnerRef.current;
      if (boardEl) {
        const boardRect = boardEl.getBoundingClientRect();
        const cursorX = e.clientX - boardRect.left;
        const cursorY = e.clientY - boardRect.top;

        let closestPoint = -1;
        let closestDist = Infinity;

        const destsForSource = legalMoves
          .filter((m) => m.from === dragState.sourcePoint)
          .map((m) => m.to);

        for (const dest of destsForSource) {
          const center = getPointCenter(dest);
          if (!center) continue;
          const dist = Math.sqrt((center.x - cursorX) ** 2 + (center.y - cursorY) ** 2);
          if (dist < closestDist) {
            closestDist = dist;
            closestPoint = dest;
          }
        }

        if (closestPoint >= 0 && closestDist < 80) {
          onMove(dragState.sourcePoint, closestPoint);
          setSelectedPoint(null);
        }
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }

    setDragState(null);
    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, [dragState, legalMoves, getPointCenter, onMove]);

  // ─── Point ordering (respects flip) ──────────────────────────

  const topLeftPts = flipped ? [12, 11, 10, 9, 8, 7] : [13, 14, 15, 16, 17, 18];
  const topRightPts = flipped ? [6, 5, 4, 3, 2, 1] : [19, 20, 21, 22, 23, 24];
  const botLeftPts = flipped ? [13, 14, 15, 16, 17, 18] : [12, 11, 10, 9, 8, 7];
  const botRightPts = flipped ? [19, 20, 21, 22, 23, 24] : [6, 5, 4, 3, 2, 1];

  const topNums = [...topLeftPts, ...topRightPts];
  const botNums = [...botLeftPts, ...botRightPts];

  // ─── Dice ────────────────────────────────────────────────────

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

  // ─── Render a point ──────────────────────────────────────────

  function renderPoint(point: number, fromTop: boolean, idx: number) {
    const val = board.points[point];
    let count = Math.abs(val);
    const col: "white" | "black" | null = val > 0 ? "white" : val < 0 ? "black" : null;
    const isSel = selectedPoint === point;
    const isDest = legalDests.has(point);
    const isSrc = legalSources.has(point) && isMyTurn;
    const isLastFrom = lastMoveFrom === point;
    const isLastTo = lastMoveTo === point;
    const vp = flipped ? 25 - point : point;
    const isDark = vp % 2 === 0;

    // Adjust display count during animation or drag
    let displayCount = count;
    if (animatingMove && !animatingMove.isPlayerMove && animatingMove.destPoint === point) {
      displayCount = Math.max(0, count - 1);
    }
    if (dragState && isDraggingRef.current && dragState.sourcePoint === point) displayCount = Math.max(0, count - 1);

    const topCheckerIdx = displayCount > 0 ? Math.min(displayCount, MAX_SHOW) - 1 : -1;
    const triangleFill = isDark ? DARK_FELT : LIGHT_FELT;

    let triHighlight: string | undefined;
    if (isLastTo) triHighlight = isDark ? "#1A2840" : "#203040";
    if (isLastFrom) triHighlight = isDark ? "#1A2838" : "#1E2C3A";

    return (
      <div
        key={`pt-${point}`}
        data-point={point}
        className="relative flex flex-col items-center"
        style={{
          width: POINT_W,
          height: POINT_H,
          justifyContent: fromTop ? "flex-start" : "flex-end",
          cursor: isSrc || isDest ? "pointer" : "default",
        }}
        onClick={() => handleClick(point)}
      >
        {/* Triangle */}
        <div
          className="absolute"
          style={{
            top: fromTop ? 0 : "auto",
            bottom: fromTop ? "auto" : 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: `${POINT_W / 2}px solid transparent`,
            borderRight: `${POINT_W / 2}px solid transparent`,
            ...(fromTop
              ? { borderTop: `${POINT_H - 16}px solid ${triHighlight || triangleFill}` }
              : { borderBottom: `${POINT_H - 16}px solid ${triHighlight || triangleFill}` }),
          }}
        />

        {/* Selected point border glow */}
        {isSel && (
          <div
            className="absolute rounded-sm"
            style={{
              inset: 0,
              border: "2px solid var(--color-gold-primary)",
              borderRadius: 4,
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "inset 0 0 12px rgba(88,20,40,0.15)",
            }}
          />
        )}

        {/* Legal source subtle pulsing glow */}
        {isSrc && !isSel && selectedPoint === null && (
          <div
            className="absolute animate-legal-pulse rounded-full"
            style={{
              width: CHECKER_SIZE + 4,
              height: CHECKER_SIZE + 4,
              top: fromTop ? 4 : "auto",
              bottom: fromTop ? "auto" : 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1,
            }}
          />
        )}

        {/* Green destination dot indicator */}
        {isDest && (
          <div
            className="absolute animate-dest-pulse"
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "rgba(100, 220, 120, 0.9)",
              boxShadow: "0 0 8px rgba(100, 220, 120, 0.6)",
              left: "50%",
              transform: "translateX(-50%)",
              top: fromTop ? POINT_H - 24 : 8,
              zIndex: 15,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Legal destination ghost checker */}
        {isDest && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: fromTop
                ? 6 + (col && displayCount > 0 ? Math.min(displayCount, MAX_SHOW) * CHECKER_VISIBLE : 0)
                : "auto",
              bottom: !fromTop
                ? 6 + (col && displayCount > 0 ? Math.min(displayCount, MAX_SHOW) * CHECKER_VISIBLE : 0)
                : "auto",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
            }}
          >
            <Checker color={myColor} isGhost />
          </div>
        )}

        {/* Checkers */}
        {col && displayCount > 0 && (
          <CheckerStack
            color={col}
            count={displayCount}
            fromTop={fromTop}
            selectedIdx={isSel ? topCheckerIdx : undefined}
            onClick={() => handleClick(point)}
          />
        )}
      </div>
    );
  }

  // ─── Bar ─────────────────────────────────────────────────────

  function renderBar(position: "top" | "bottom") {
    const wCount = board.points[WHITE_BAR];
    const bCount = Math.abs(board.points[BLACK_BAR]);
    const wSrc = legalSources.has(WHITE_BAR) && isMyTurn;
    const bSrc = legalSources.has(BLACK_BAR) && isMyTurn;

    const isTop = position === "top";
    const topColor: "white" | "black" = flipped ? "white" : "black";
    const botColor: "white" | "black" = flipped ? "black" : "white";
    const topCount = topColor === "white" ? wCount : bCount;
    const botCount = botColor === "white" ? wCount : bCount;
    const topBarIdx = topColor === "white" ? WHITE_BAR : BLACK_BAR;
    const botBarIdx = botColor === "white" ? WHITE_BAR : BLACK_BAR;
    const topSrc = topColor === "white" ? wSrc : bSrc;
    const botSrc = botColor === "white" ? wSrc : bSrc;

    const pipLabel = pipCounts ? (isTop ? pipCounts[0] : pipCounts[1]) : null;

    return (
      <div
        className="flex flex-col items-center shrink-0"
        style={{
          width: BAR_W,
          background: "var(--color-bg-deepest)",
          margin: "0 4px",
          borderRadius: 4,
          borderLeft: "1px solid var(--color-bg-subtle)",
          borderRight: "1px solid var(--color-bg-subtle)",
          justifyContent: isTop ? "flex-start" : "flex-end",
          padding: isTop ? "12px 0 0" : "0 0 12px",
          gap: 8,
          height: POINT_H,
        }}
      >
        {isTop && (
          <>
            {pipLabel !== null && (
              <div className="text-center leading-none">
                <div className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">PIP</div>
                <div className="text-[13px] font-bold text-[var(--color-text-secondary)]">{pipLabel}</div>
              </div>
            )}
            {topCount > 0 && (
              <div
                data-point={topBarIdx}
                className="flex flex-col items-center"
                style={{ gap: -(CHECKER_SIZE - CHECKER_VISIBLE) }}
                onClick={() => topSrc && handleClick(topBarIdx)}
              >
                {Array.from({ length: Math.min(topCount, 3) }).map((_, i) => (
                  <div key={i} style={{ marginTop: i > 0 ? -(CHECKER_SIZE - CHECKER_VISIBLE) : 0 }}>
                    <Checker
                      color={topColor}
                      highlighted={selectedPoint === topBarIdx && i === Math.min(topCount, 3) - 1}
                      onClick={topSrc ? () => handleClick(topBarIdx) : undefined}
                    />
                  </div>
                ))}
                {topCount > 3 && (
                  <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{topCount}</span>
                )}
              </div>
            )}
          </>
        )}
        {!isTop && (
          <>
            {botCount > 0 && (
              <div
                data-point={botBarIdx}
                className="flex flex-col-reverse items-center"
                onClick={() => botSrc && handleClick(botBarIdx)}
              >
                {Array.from({ length: Math.min(botCount, 3) }).map((_, i) => (
                  <div key={i} style={{ marginBottom: i > 0 ? -(CHECKER_SIZE - CHECKER_VISIBLE) : 0 }}>
                    <Checker
                      color={botColor}
                      highlighted={selectedPoint === botBarIdx && i === Math.min(botCount, 3) - 1}
                      onClick={botSrc ? () => handleClick(botBarIdx) : undefined}
                    />
                  </div>
                ))}
                {botCount > 3 && (
                  <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{botCount}</span>
                )}
              </div>
            )}
            {pipLabel !== null && (
              <div className="text-center leading-none">
                <div className="text-[13px] font-bold text-[var(--color-text-secondary)]">{pipLabel}</div>
                <div className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">PIP</div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Point numbers ───────────────────────────────────────────

  function renderPointNumbers(numbers: number[]) {
    return (
      <div className="flex items-center" style={{ padding: "0 6px", height: 20 }}>
        <div className="flex flex-1" style={{ gap: POINT_GAP }}>
          {numbers.slice(0, 6).map((n) => (
            <div key={n} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)]" style={{ width: POINT_W }}>
              {n}
            </div>
          ))}
        </div>
        <div style={{ width: BAR_W + 8 }} />
        <div className="flex flex-1" style={{ gap: POINT_GAP }}>
          {numbers.slice(6).map((n) => (
            <div key={n} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)]" style={{ width: POINT_W }}>
              {n}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Bear-off ────────────────────────────────────────────────

  const hasAnyBearOff = isMyTurn && legalMoves.some((m) => m.to === 0 || m.to === 25);
  const canBear = hasAnyBearOff || (selectedPoint !== null && (legalDests.has(0) || legalDests.has(25)));
  const bearTopColor: "white" | "black" = flipped ? "white" : "black";
  const bearBotColor: "white" | "black" = flipped ? "black" : "white";
  const bearTopCount = bearTopColor === "white" ? board.whiteOff : board.blackOff;
  const bearBotCount = bearBotColor === "white" ? board.whiteOff : board.blackOff;

  // ─── Scale-to-fit: measure container, compute scale ──────────

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const sx = width / BOARD_TOTAL_W;
    const sy = height / BOARD_TOTAL_H;
    setScale(Math.min(sx, sy));
  }, []);

  useEffect(() => {
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateScale]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ touchAction: dragState ? "none" : "auto" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
    <div
      className="flex items-stretch select-none"
      style={{
        opacity: gameOver ? 0.4 : 1,
        pointerEvents: gameOver ? "none" : "auto",
        transition: "opacity 300ms ease",
        zoom: scale,
      }}
    >
      {/* Main Board */}
      <div
        ref={boardInnerRef}
        className="flex flex-col"
        style={{
          background: "var(--color-bg-base)",
          borderRadius: "12px 0 0 12px",
          border: "2px solid var(--color-bg-subtle)",
          borderRight: "none",
          padding: "4px 0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        {renderPointNumbers(topNums)}

        {/* Top half */}
        <div className="flex" style={{ padding: "0 6px" }}>
          <div className="flex" style={{ gap: POINT_GAP }}>
            {topLeftPts.map((pt, i) => renderPoint(pt, true, i))}
          </div>
          {renderBar("top")}
          <div className="flex" style={{ gap: POINT_GAP }}>
            {topRightPts.map((pt, i) => renderPoint(pt, true, i + 6))}
          </div>
        </div>

        {/* Center strip */}
        <div
          className="flex items-center justify-center relative"
          style={{ padding: "6px 0", gap: 16, minHeight: 60 }}
        >
          {centerControls ?? (
            diceList.length > 0 && (
              <div className="flex" style={{ gap: 8 }}>
                {diceList.map((d, i) => (
                  <Die key={i} value={d.value} used={d.used} player={isMyTurn ? myColor : (myColor === "white" ? "black" : "white")} />
                ))}
              </div>
            )
          )}
        </div>

        {/* Bottom half */}
        <div className="flex" style={{ padding: "0 6px" }}>
          <div className="flex" style={{ gap: POINT_GAP }}>
            {botLeftPts.map((pt, i) => renderPoint(pt, false, i))}
          </div>
          {renderBar("bottom")}
          <div className="flex" style={{ gap: POINT_GAP }}>
            {botRightPts.map((pt, i) => renderPoint(pt, false, i + 6))}
          </div>
        </div>

        {renderPointNumbers(botNums)}

        {/* Animated checker overlay */}
        {animatingMove && (
          <div
            style={{
              position: "absolute",
              left: animatingMove.fromX / scale - CHECKER_SIZE / 2,
              top: animatingMove.fromY / scale - CHECKER_SIZE / 2,
              width: CHECKER_SIZE,
              height: CHECKER_SIZE,
              zIndex: 100,
              pointerEvents: "none",
              "--fly-dx": `${(animatingMove.toX - animatingMove.fromX) / scale}px`,
              "--fly-dy": `${(animatingMove.toY - animatingMove.fromY) / scale}px`,
              animation: "checker-fly 200ms ease-out forwards",
            } as React.CSSProperties}
          >
            <Checker color={animatingMove.color} />
          </div>
        )}
      </div>

      {/* Bear-off Tray */}
      <div
        className="flex flex-col"
        style={{
          width: BEAROFF_W,
          background: "var(--color-bg-base)",
          borderRadius: "0 12px 12px 0",
          borderTop: `2px solid ${canBear ? "rgba(100,220,120,0.7)" : "var(--color-bg-subtle)"}`,
          borderRight: `2px solid ${canBear ? "rgba(100,220,120,0.7)" : "var(--color-bg-subtle)"}`,
          borderBottom: `2px solid ${canBear ? "rgba(100,220,120,0.7)" : "var(--color-bg-subtle)"}`,
          borderLeft: "1px solid var(--color-bg-subtle)",
          boxShadow: canBear
            ? "0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(100,220,120,0.3)"
            : "0 4px 24px rgba(0,0,0,0.5)",
          cursor: canBear ? "pointer" : "default",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          position: "relative",
        }}
        onClick={handleBearOff}
      >
        {/* Opponent borne-off (top) */}
        <div className="flex-1 flex flex-col items-center justify-start" style={{ padding: "24px 0 8px", gap: 1 }}>
          {Array.from({ length: Math.min(bearTopCount, 15) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 36, height: 8, borderRadius: 4,
                background: bearTopColor === "white" ? "var(--color-text-primary)" : "#6E1A30",
                border: `1px solid ${bearTopColor === "white" ? "var(--color-text-secondary)" : "var(--color-burgundy-deep)"}`,
              }}
            />
          ))}
          {bearTopCount > 0 && (
            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] mt-1">{bearTopCount}</span>
          )}
        </div>

        {/* Green dot when bear-off is legal */}
        {canBear && (
          <div
            className="animate-dest-pulse"
            style={{
              position: "absolute",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "rgba(100, 220, 120, 0.9)",
              boxShadow: "0 0 8px rgba(100, 220, 120, 0.6)",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 15,
              pointerEvents: "none",
            }}
          />
        )}

        <div className="mx-2" style={{ height: 1, background: "var(--color-bg-subtle)" }} />

        {/* Player borne-off (bottom) */}
        <div className="flex-1 flex flex-col items-center justify-end" style={{ padding: "8px 0 24px", gap: 1 }}>
          {bearBotCount > 0 && (
            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] mb-1">{bearBotCount}</span>
          )}
          {Array.from({ length: Math.min(bearBotCount, 15) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 36, height: 8, borderRadius: 4,
                background: bearBotColor === "white" ? "var(--color-text-primary)" : "#6E1A30",
                border: `1px solid ${bearBotColor === "white" ? "var(--color-text-secondary)" : "var(--color-burgundy-deep)"}`,
              }}
            />
          ))}
        </div>
      </div>
    </div>

    {/* Floating drag checker */}
    {dragState && isDraggingRef.current && (
      <div
        style={{
          position: "fixed",
          left: dragState.cursorX - (CHECKER_SIZE * scale) / 2,
          top: dragState.cursorY - (CHECKER_SIZE * scale) / 2,
          width: CHECKER_SIZE * scale,
          height: CHECKER_SIZE * scale,
          zIndex: 200,
          pointerEvents: "none",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          transform: "scale(1.1)",
          transformOrigin: "center",
        }}
      >
        <div style={{ width: CHECKER_SIZE, height: CHECKER_SIZE, zoom: scale }}>
          <Checker color={dragState.color} highlighted />
        </div>
      </div>
    )}
    </div>
  );
}
