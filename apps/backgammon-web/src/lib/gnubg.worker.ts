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
    plies?: number;
    cubeful?: boolean;
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
    // Blob-URL workers can't resolve root-relative paths, so build absolute URLs
    const base = self.origin;

    // Load the Go WASM runtime bridge via fetch+eval
    // (importScripts fails in blob-URL workers created by webpack)
    const jsText = await (await fetch(`${base}/gnubg/wasm_exec.js`)).text();
    (0, eval)(jsText);

    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch(`${base}/gnubg/gbweb.1.wasm`),
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
      plies: payload.plies ?? 0,
      cubeful: payload.cubeful ?? true,
    });

    const resultJson = wasm_get_moves(args);
    const parsed = JSON.parse(resultJson);

    if (parsed.error) {
      self.postMessage({ type: "error", id, error: parsed.error });
      return;
    }

    // Handle both array and object-with-moves response formats
    let moves: GnubgRawMove[];
    if (Array.isArray(parsed)) {
      moves = parsed;
    } else if (parsed.moves && Array.isArray(parsed.moves)) {
      moves = parsed.moves;
    } else {
      moves = [];
    }
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
