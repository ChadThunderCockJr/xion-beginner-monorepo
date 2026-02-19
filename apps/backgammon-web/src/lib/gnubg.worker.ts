/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

// Go WASM runtime declares this globally after wasm_exec.js loads
declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

// The WASM binary exports this global function
declare function wasm_get_moves(json: string): string;

/* ── Types ── */

export interface GnubgRequest {
  type: "getMoves";
  id: number;
  payload: {
    board: { x: Record<string, number | undefined>; o: Record<string, number | undefined> };
    dice: [number, number];
    maxMoves?: number;
    scoreMoves?: boolean;
  };
}

export type GnubgResponse =
  | { type: "ready" }
  | { type: "result"; id: number; moves: GnubgRawMove[] }
  | { type: "error"; id: number; error: string };

export interface GnubgRawMove {
  play?: { from: string; to: string }[];
  evaluation?: {
    eq: number;
    diff: number;
    info?: { cubeful: boolean; plies: number };
    probability?: {
      win: number;
      winG: number;
      winBG: number;
      lose: number;
      loseG: number;
      loseBG: number;
    };
  };
}

/* ── WASM Loading ── */

let ready = false;

async function init() {
  try {
    // Load the Go WASM runtime bridge
    importScripts("/gnubg/wasm_exec.js");

    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch("/gnubg/gbweb.1.wasm"),
      go.importObject,
    );

    // Run the Go runtime (this registers wasm_get_moves on globalThis)
    // Don't await — go.run() blocks until the Go program exits
    go.run(result.instance);

    ready = true;
    self.postMessage({ type: "ready" } satisfies GnubgResponse);
  } catch (err) {
    self.postMessage({
      type: "error",
      id: -1,
      error: `WASM init failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies GnubgResponse);
  }
}

/* ── Message Handler ── */

self.onmessage = (e: MessageEvent<GnubgRequest>) => {
  const { type, id, payload } = e.data;

  if (type !== "getMoves") {
    self.postMessage({ type: "error", id, error: `Unknown message type: ${type}` });
    return;
  }

  if (!ready) {
    self.postMessage({ type: "error", id, error: "WASM engine not ready" });
    return;
  }

  try {
    const args = JSON.stringify({
      board: { x: payload.board.x, o: payload.board.o },
      dice: payload.dice,
      player: "x", // We always map current player as X
      "max-moves": payload.maxMoves ?? 0,
      "score-moves": payload.scoreMoves ?? false,
    });

    const resultJson = wasm_get_moves(args);
    const parsed = JSON.parse(resultJson);

    if (parsed.error) {
      self.postMessage({ type: "error", id, error: parsed.error });
      return;
    }

    const moves: GnubgRawMove[] = Array.isArray(parsed) ? parsed : [];
    self.postMessage({ type: "result", id, moves });
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      error: `getMoves failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

// Start loading WASM immediately
init();
