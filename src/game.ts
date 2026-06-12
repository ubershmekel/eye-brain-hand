// Core types and pure helpers for the Eye-Brain-Hand snapshot game.

export const GRID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const ROUNDS = 3;
export const TARGETS_PER_ROUND = 3;

export interface TapRecord {
  /** 1-based round number */
  round: number;
  /** 1-based tap number within the round */
  tap: number;
  /** The letter the player was supposed to tap */
  expected: string;
  /** The cell the player actually tapped */
  tapped: string;
  /** Milliseconds since the previous tap (or since the round's targets appeared) */
  delayMs: number;
  /** Pixel distance from the tap point to the center of the expected cell */
  distancePx: number;
  /** Same distance, as a percentage of the cell's half-diagonal (0% = dead center) */
  distancePct: number;
  /** Whether the tap landed inside the expected cell */
  hit: boolean;
}

export interface SessionSummary {
  /** ISO timestamp of when the session finished */
  date: string;
  medianDelayMs: number;
  medianDistancePx: number;
  medianDistancePct: number;
  hits: number;
  totalTaps: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pick `count` distinct random letters A-Z. */
export function pickTargets(count: number): string[] {
  const pool = [...LETTERS];
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function summarize(taps: TapRecord[]): SessionSummary {
  return {
    date: new Date().toISOString(),
    medianDelayMs: Math.round(median(taps.map((t) => t.delayMs))),
    medianDistancePx: round1(median(taps.map((t) => t.distancePx))),
    medianDistancePct: round1(median(taps.map((t) => t.distancePct))),
    hits: taps.filter((t) => t.hit).length,
    totalTaps: taps.length,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const HISTORY_KEY = "eye-brain-hand-history";

export function loadHistory(): SessionSummary[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SessionSummary[]) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(summary: SessionSummary): SessionSummary[] {
  const history = loadHistory();
  history.push(summary);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage may be unavailable (private mode); the session still shows on screen.
  }
  return history;
}
