"use client";

import { useState } from "react";

interface LobbyProps {
  onCreateGame: (wagerAmount: number) => void;
  onJoinGame: (gameId: string) => void;
  onJoinQueue: (wagerAmount: number) => void;
  onLeaveQueue: () => void;
  status: string;
  connected: boolean;
  address: string | null;
}

const MATCH_OPTIONS = [
  { points: 1, label: "1", sublabel: "Quick" },
  { points: 3, label: "3", sublabel: "Standard" },
  { points: 5, label: "5", sublabel: "Classic" },
  { points: 7, label: "7", sublabel: "Extended" },
  { points: 11, label: "11", sublabel: "Tournament" },
  { points: 15, label: "15", sublabel: "Marathon" },
];

export function Lobby({
  onCreateGame,
  onJoinGame,
  onJoinQueue,
  onLeaveQueue,
  status,
  connected,
  address,
}: LobbyProps) {
  const [matchPoints, setMatchPoints] = useState(3);
  const [joinGameId, setJoinGameId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  if (!address) return null;

  // ─── Connecting ───
  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-5 p-8 animate-fade-in">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Connecting...</p>
      </div>
    );
  }

  // ─── Queued ───
  if (status === "queued") {
    return (
      <div className="flex flex-col items-center gap-6 p-8 max-w-xs mx-auto animate-fade-in">
        <div className="w-10 h-10 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold">Finding opponent...</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {matchPoints}-point match
          </p>
        </div>
        <button onClick={onLeaveQueue} className="btn-danger">
          Cancel
        </button>
      </div>
    );
  }

  // ─── Waiting ───
  if (status === "waiting") {
    return (
      <div className="flex flex-col items-center gap-6 p-8 max-w-xs mx-auto animate-fade-in">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-pulse" />
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold">Waiting for opponent</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Share the game link with a friend
          </p>
        </div>
      </div>
    );
  }

  // ─── Ready (Idle) ───
  return (
    <div className="flex flex-col gap-5 p-6 max-w-sm mx-auto w-full animate-fade-in">
      {/* Player header */}
      <div className="flex items-center gap-2.5 px-1">
        <div className="w-7 h-7 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
          {address.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)]">{address}</span>
        <span className="flex items-center gap-1 ml-auto text-[11px] text-[var(--success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          Online
        </span>
      </div>

      {/* Match length */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Match Length
          </span>
          <span className="text-[12px] text-[var(--text-faint)]">
            First to {matchPoints}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MATCH_OPTIONS.map(({ points, label, sublabel }) => (
            <button
              key={points}
              onClick={() => setMatchPoints(points)}
              className={`py-3 rounded-[var(--radius-md)] font-semibold transition-colors ${
                matchPoints === points
                  ? "bg-[var(--gold)] text-[var(--bg-deepest)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="text-base">{label}</span>
              <span className={`block text-[9px] uppercase tracking-wider mt-0.5 ${
                matchPoints === points ? "opacity-60" : "text-[var(--text-faint)]"
              }`}>
                {sublabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Find Match */}
      <button
        onClick={() => onJoinQueue(matchPoints)}
        className="btn-primary w-full py-3.5 text-base"
      >
        <span className="block font-bold">Find Match</span>
        <span className="block text-[12px] opacity-60 mt-0.5">
          {matchPoints}-Point Game
        </span>
      </button>

      {/* Secondary actions */}
      <div className="flex gap-2.5">
        <button
          onClick={() => onCreateGame(matchPoints)}
          className="btn-secondary flex-1 text-sm"
        >
          Create Game
        </button>
        <button
          onClick={() => setShowJoinInput(!showJoinInput)}
          className={`btn-secondary flex-1 text-sm ${
            showJoinInput ? "border-[var(--gold)] text-[var(--text-primary)]" : ""
          }`}
        >
          Join Game
        </button>
      </div>

      {/* Join by ID */}
      {showJoinInput && (
        <div className="panel p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              placeholder="Paste game ID..."
              className="input flex-1 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinGameId) onJoinGame(joinGameId);
              }}
              autoFocus
            />
            <button
              onClick={() => joinGameId && onJoinGame(joinGameId)}
              disabled={!joinGameId}
              className="btn-primary px-5 text-sm"
            >
              Join
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
