import { Move, Player, MoveRecord } from "./types";

/** Format a single move in standard notation (e.g., "13/7", "bar/20", "6/off") */
export function formatMove(move: Move, player: Player): string {
  let fromStr: string;
  if (
    (player === "white" && move.from === 0) ||
    (player === "black" && move.from === 25)
  ) {
    fromStr = "bar";
  } else {
    fromStr = move.from.toString();
  }

  let toStr: string;
  if (
    (player === "white" && move.to === 0) ||
    (player === "black" && move.to === 25)
  ) {
    toStr = "off";
  } else {
    toStr = move.to.toString();
  }

  return `${fromStr}/${toStr}`;
}

/** Format a complete turn (e.g., "31: 13/10 8/7") */
export function formatTurn(record: MoveRecord): string {
  const diceStr =
    record.dice[0] === record.dice[1]
      ? `${record.dice[0]}${record.dice[0]}`
      : `${record.dice[0]}${record.dice[1]}`;

  if (record.moves.length === 0) return `${diceStr}: (no moves)`;

  const movesStr = record.moves
    .map((m) => formatMove(m, record.player))
    .join(" ");

  return `${diceStr}: ${movesStr}`;
}

/** Format entire game as text notation */
export function formatGame(history: MoveRecord[]): string {
  const lines: string[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const turnNum = Math.floor(i / 2) + 1;
    const white = history[i] ? formatTurn(history[i]) : "";
    const black = history[i + 1] ? formatTurn(history[i + 1]) : "";
    lines.push(`${turnNum}. ${white}  ${black}`);
  }
  return lines.join("\n");
}
