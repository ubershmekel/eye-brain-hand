// Core types and pure helpers for the Eye-Brain-Hand snapshot game.

// 5x5 grid: the alphabet minus Z.
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXY".split("");

export const ROUNDS = 3;
export const TARGETS_PER_ROUND = 3;

/** Fisher-Yates shuffle, returns a new array. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
  /** PointerEvent.pointerType: "mouse", "touch", "pen", or "" */
  pointerType: string;
}

/** What the player used for the whole session. */
export type InputKind = "mouse" | "touch" | "pen" | "mixed" | "unknown";

export function inputLabel(input: string | undefined): string {
  switch (input) {
    case "mouse":
      return "🖱️ mouse";
    case "touch":
      return "👆 touch";
    case "pen":
      return "🖊️ pen";
    case "mixed":
      return "🖱️👆 mixed";
    default:
      return "❓ unknown";
  }
}

/** Inline phrase with the right verb, e.g. "median 🖱️ mouse click delay". */
export function inputPhrase(input: string | undefined): string {
  switch (input) {
    case "mouse":
      return "🖱️ mouse click";
    case "touch":
      return "👆 finger tap";
    case "pen":
      return "🖊️ pen tap";
    case "mixed":
      return "🖱️👆 mixed input";
    default:
      return "❓ tap";
  }
}

/**
 * Best-effort device description, e.g. "📱 Safari on iPhone (iOS 18)" or
 * "💻 Chrome on Windows PC". Browsers hide exact iPhone models, but Android
 * usually exposes its model, and OS/browser are reliable.
 */
export function deviceGuess(): string {
  const ua = navigator.userAgent;
  let device = "unknown device";
  let mobile = false;

  const android = ua.match(/Android ([\d.]+)(?:; ([^;)]+))?/);
  if (/iPhone/.test(ua)) {
    const v = ua.match(/iPhone OS (\d+)/);
    device = v ? `iPhone (iOS ${v[1]})` : "iPhone";
    mobile = true;
  } else if (
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    device = "iPad";
    mobile = true;
  } else if (android) {
    // Modern Chrome reduces the model to a literal "K"; ignore that.
    const model = android[2]?.replace(/ Build\/.*/, "").trim();
    const version = `Android ${parseInt(android[1])}`;
    device = model && model !== "K" ? `${model} (${version})` : version;
    mobile = true;
  } else if (/Windows/.test(ua)) {
    device = "Windows PC";
  } else if (/CrOS/.test(ua)) {
    device = "Chromebook";
  } else if (/Macintosh/.test(ua)) {
    device = "Mac";
  } else if (/Linux/.test(ua)) {
    device = "Linux PC";
  }

  let browser = "browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${mobile ? "📱" : "💻"} ${browser} on ${device}`;
}

export function dominantInput(taps: TapRecord[]): InputKind {
  const kinds = new Set(taps.map((t) => t.pointerType).filter(Boolean));
  if (kinds.size === 0) return "unknown";
  if (kinds.size > 1) return "mixed";
  const kind = [...kinds][0];
  return kind === "mouse" || kind === "touch" || kind === "pen"
    ? kind
    : "unknown";
}

export interface SessionSummary {
  /** ISO timestamp of when the session finished */
  date: string;
  medianDelayMs: number;
  medianDistancePx: number;
  medianDistancePct: number;
  hits: number;
  totalTaps: number;
  /** Optional because sessions saved by older versions lack it. */
  input?: InputKind;
  /** Best-effort device description; optional for older saved sessions. */
  device?: string;
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
    input: dominantInput(taps),
    device: deviceGuess(),
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
