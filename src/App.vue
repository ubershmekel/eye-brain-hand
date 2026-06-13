<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  LETTERS,
  ROUNDS,
  TARGETS_PER_ROUND,
  type SessionSummary,
  type TapRecord,
  inputLabel,
  inputPhrase,
  loadHistory,
  median,
  pickTargets,
  round1,
  saveToHistory,
  shuffle,
  summarize,
} from "./game";

type Phase = "intro" | "shuffling" | "playing" | "results";

const SHUFFLE_MS = 600;
const SHUFFLE_TICK_MS = 75;

const phase = ref<Phase>("intro");
const round = ref(0); // 1-based once playing
const targets = ref<string[]>([]);
const targetIndex = ref(0); // which of the 3 targets is next
const taps = ref<TapRecord[]>([]);
const history = ref<SessionSummary[]>(loadHistory());
const summary = ref<SessionSummary | null>(null);

// The grid layout for this play: shuffled once per game, constant across rounds.
const gridChars = ref<string[]>(shuffle(LETTERS));
// What the cells currently display (scrambles during the start animation).
const displayChars = ref<string[]>([...gridChars.value]);

const gridEl = ref<HTMLElement | null>(null);
let lastTime = 0;
let shuffleTimer = 0;

// True when part of the grid is outside the viewport (e.g. phone landscape).
const gridClipped = ref(false);

function checkGridFits() {
  // setTimeout instead of requestAnimationFrame: rAF doesn't fire in
  // background/hidden windows, and we measure after the DOM settles anyway.
  setTimeout(() => {
    const el = gridEl.value;
    if (!el) {
      gridClipped.value = false;
      return;
    }
    const r = el.getBoundingClientRect();
    gridClipped.value =
      r.bottom > window.innerHeight + 1 ||
      r.top < -1 ||
      r.right > window.innerWidth + 1 ||
      r.left < -1;
  }, 50);
}

watch(phase, checkGridFits);
onMounted(() => window.addEventListener("resize", checkGridFits));
onBeforeUnmount(() => window.removeEventListener("resize", checkGridFits));

function startGame() {
  taps.value = [];
  summary.value = null;
  round.value = 0;
  targets.value = [];
  gridChars.value = shuffle(LETTERS);
  phase.value = "shuffling";

  // Scramble the visible letters for a moment — when they settle, time starts.
  const started = performance.now();
  clearInterval(shuffleTimer);
  shuffleTimer = window.setInterval(() => {
    if (performance.now() - started >= SHUFFLE_MS) {
      clearInterval(shuffleTimer);
      displayChars.value = [...gridChars.value];
      phase.value = "playing";
      nextRound();
    } else {
      displayChars.value = shuffle(LETTERS);
    }
  }, SHUFFLE_TICK_MS);
}

function nextRound() {
  round.value += 1;
  targets.value = pickTargets(TARGETS_PER_ROUND);
  targetIndex.value = 0;
  // The clock for the round's first tap starts when the targets appear.
  requestAnimationFrame(() => {
    lastTime = performance.now();
  });
}

function onCellTap(char: string, event: PointerEvent) {
  if (phase.value !== "playing") return;
  event.preventDefault();

  const now = performance.now();
  const expected = targets.value[targetIndex.value];
  const cell = gridEl.value?.querySelector<HTMLElement>(
    `[data-char="${expected}"]`,
  );
  let distancePx = 0;
  let distancePct = 0;
  if (cell) {
    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    distancePx = Math.hypot(event.clientX - cx, event.clientY - cy);
    const halfDiagonal = Math.hypot(rect.width / 2, rect.height / 2);
    distancePct = (distancePx / halfDiagonal) * 100;
  }

  taps.value.push({
    round: round.value,
    tap: targetIndex.value + 1,
    expected,
    tapped: char,
    delayMs: now - lastTime,
    distancePx,
    distancePct,
    hit: char === expected,
    pointerType: event.pointerType,
  });
  lastTime = now;

  if (targetIndex.value + 1 < TARGETS_PER_ROUND) {
    targetIndex.value += 1;
  } else if (round.value < ROUNDS) {
    nextRound();
  } else {
    finishGame();
  }
}

function finishGame() {
  const result = summarize(taps.value);
  summary.value = result;
  history.value = saveToHistory(result);
  phase.value = "results";
}

const delays = computed(() => taps.value.map((t) => t.delayMs));
const distances = computed(() => taps.value.map((t) => t.distancePx));

const bestDelay = computed(() => Math.min(...delays.value));
const worstDelay = computed(() => Math.max(...delays.value));
const bestDistance = computed(() => Math.min(...distances.value));
const worstDistance = computed(() => Math.max(...distances.value));
const medianDelay = computed(() => median(delays.value));
const medianDistance = computed(() => median(distances.value));

const pastSessions = computed(() =>
  [...history.value].reverse().slice(0, 20),
);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function goHome() {
  phase.value = "intro";
}

const SITE_URL = "https://ubershmekel.github.io/eye-brain-hand/";
const canShare = typeof navigator !== "undefined" && !!navigator.share;
const copyLabel = ref("📋 Copy");

function resultsText(): string {
  const s = summary.value;
  if (!s) return "";
  return (
    `Eye 👁 Brain 🧠 Hand ✋ score:\n` +
    `⏱ ${s.medianDelayMs} ms median ${inputPhrase(s.input)} delay\n` +
    `🎯 ${s.medianDistancePx} px median distance from center\n` +
    `✅ ${s.hits}/${s.totalTaps} correct\n` +
    (s.device ? `${s.device}\n` : "") +
    `Get your score: ${SITE_URL}`
  );
}

async function shareResults() {
  if (!summary.value) return;
  try {
    await navigator.share({ text: resultsText() });
  } catch {
    // The user closed the share sheet; nothing to do.
  }
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

async function copyResults() {
  if (!summary.value) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(resultsText());
    ok = true;
  } catch {
    ok = legacyCopy(resultsText());
  }
  copyLabel.value = ok ? "✅ Copied!" : "Copy failed";
  setTimeout(() => (copyLabel.value = "📋 Copy"), 2000);
}

function clearHistory() {
  if (!confirm("Delete all saved sessions?")) return;
  localStorage.removeItem("eye-brain-hand-history");
  history.value = [];
}
</script>

<template>
  <main class="app">
    <!-- Intro -->
    <section v-if="phase === 'intro'" class="screen intro">
      <img class="logo" src="/favicon.svg" alt="" width="72" height="72" />
      <h1>Eye 👁 Brain 🧠 Hand ✋</h1>
      <p>
        Three letters appear at the top. Tap them on the grid below,
        <strong>in order</strong>, aiming for the crosshair-marked center of
        each cell. You'll do {{ ROUNDS }} rounds of
        {{ TARGETS_PER_ROUND }} letters.
      </p>
      <p class="dim">
        Every tap counts — speed and pixel accuracy are both measured. Play
        once a year to track your decline, or mid-marathon to watch your brain
        melt in real time.
      </p>
      <button class="primary" @click="startGame">Start</button>

      <div v-if="pastSessions.length" class="history">
        <h2>Past sessions</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Median delay</th>
                <th>Median accuracy</th>
                <th>Hits</th>
                <th>Input</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in pastSessions" :key="s.date">
                <td>{{ formatDate(s.date) }}</td>
                <td>{{ s.medianDelayMs }} ms</td>
                <td>{{ s.medianDistancePx }} px</td>
                <td>{{ s.hits }}/{{ s.totalTaps }}</td>
                <td>{{ inputLabel(s.input) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="ghost" @click="clearHistory">Clear history</button>
      </div>
    </section>

    <!-- Playing (including the pre-round shuffle animation) -->
    <section v-else-if="phase === 'shuffling' || phase === 'playing'" class="screen playing">
      <header class="hud">
        <div class="round-label">
          {{ phase === "shuffling" ? "Get ready…" : `Round ${round}/${ROUNDS}` }}
        </div>
        <div class="targets">
          <template v-if="phase === 'shuffling'">
            <span v-for="i in TARGETS_PER_ROUND" :key="'placeholder-' + i" class="target placeholder">
              ?
            </span>
          </template>
          <template v-else>
            <span v-for="(t, i) in targets" :key="round + '-' + i" class="target"
              :class="{ done: i < targetIndex, current: i === targetIndex }">
              {{ t }}
            </span>
          </template>
        </div>
      </header>

      <div v-if="gridClipped" class="clip-warning">
        ⚠️ Part of the grid is off-screen — rotate your phone or enlarge the
        window so all letters are visible.
      </div>

      <div ref="gridEl" class="grid" :class="{ scrambling: phase === 'shuffling' }">
        <button v-for="(char, i) in displayChars" :key="i" class="cell" :data-char="char"
          @pointerdown="onCellTap(char, $event)">
          <span class="glyph">{{ char }}</span>
          <span class="cross"></span>
        </button>
      </div>
    </section>

    <!-- Results -->
    <section v-else class="screen results">
      <h1>Your snapshot</h1>
      <p v-if="summary?.device" class="dim device-line">{{ summary.device }}</p>

      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-value">{{ Math.round(medianDelay) }} ms</div>
          <div class="stat-label">
            median {{ inputPhrase(summary?.input) }} delay
          </div>
          <div class="stat-sub">
            best {{ Math.round(bestDelay) }} · worst
            {{ Math.round(worstDelay) }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ round1(medianDistance) }} px</div>
          <div class="stat-label">median distance from center</div>
          <div class="stat-sub">
            best {{ round1(bestDistance) }} · worst
            {{ round1(worstDistance) }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ summary?.hits }}/{{ summary?.totalTaps }}
          </div>
          <div class="stat-label">correct cells</div>
          <div class="stat-sub">
            {{ round1(summary?.medianDistancePct ?? 0) }}% of cell radius
          </div>
        </div>
      </div>

      <h2>All taps</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Target</th>
              <th>Tapped</th>
              <th>Delay</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in taps" :key="i">
              <td>{{ t.round }}.{{ t.tap }}</td>
              <td>{{ t.expected }}</td>
              <td :class="t.hit ? 'good' : 'bad'">{{ t.tapped }}</td>
              <td>{{ Math.round(t.delayMs) }} ms</td>
              <td>{{ round1(t.distancePx) }} px</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="actions">
        <button class="primary" @click="startGame">Play again</button>
        <button v-if="canShare" class="ghost" @click="shareResults">
          📤 Share
        </button>
        <button class="ghost" @click="copyResults">{{ copyLabel }}</button>
        <button class="ghost" @click="goHome">🏠 Home</button>
      </div>

      <div v-if="pastSessions.length > 1" class="history">
        <h2>Past sessions</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Median delay</th>
                <th>Median accuracy</th>
                <th>Hits</th>
                <th>Input</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in pastSessions" :key="s.date">
                <td>{{ formatDate(s.date) }}</td>
                <td>{{ s.medianDelayMs }} ms</td>
                <td>{{ s.medianDistancePx }} px</td>
                <td>{{ s.hits }}/{{ s.totalTaps }}</td>
                <td>{{ inputLabel(s.input) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.logo {
  margin-top: 24px;
}

h1 {
  font-size: 1.6rem;
  margin: 12px 0;
  text-align: center;
}

h2 {
  font-size: 1.1rem;
  margin: 20px 0 8px;
}

p {
  margin: 8px 0;
  line-height: 1.5;
  text-align: center;
}

.dim {
  color: var(--dim);
  font-size: 0.9rem;
}

button.primary {
  margin-top: 16px;
  padding: 14px 48px;
  font-size: 1.2rem;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #1a1408;
  font-weight: 700;
  cursor: pointer;
}

button.primary:active {
  transform: scale(0.97);
}

button.ghost {
  margin-top: 12px;
  padding: 8px 16px;
  border: 1px solid var(--cell-border);
  border-radius: 8px;
  background: transparent;
  color: var(--dim);
  cursor: pointer;
}

/* ---- Playing ---- */
.playing {
  justify-content: flex-start;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.hud {
  width: 100%;
  text-align: center;
  padding: 8px 0 16px;
}

.round-label {
  color: var(--dim);
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.targets {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.target {
  font-size: 2.6rem;
  font-weight: 800;
  width: 64px;
  line-height: 64px;
  border-radius: 12px;
  background: var(--panel);
  transition: opacity 0.15s;
}

.target.done {
  opacity: 0.25;
}

.target.current {
  outline: 2px solid var(--accent);
}

.target.placeholder {
  color: var(--dim);
  opacity: 0.5;
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  width: 100%;
  /* The grid is square (1:1 cells), so capping width by the viewport height
     keeps the whole thing on screen in landscape. */
  max-width: min(480px, calc(100vh - 210px));
}

/* Short viewports (phone landscape): compact the HUD, give the grid more room. */
@media (max-height: 540px) {
  .hud {
    padding: 2px 0 8px;
  }

  .round-label {
    margin-bottom: 4px;
  }

  .target {
    width: 40px;
    line-height: 40px;
    font-size: 1.6rem;
    border-radius: 8px;
  }

  .grid {
    max-width: min(480px, calc(100vh - 130px));
  }
}

.clip-warning {
  background: rgba(255, 183, 77, 0.12);
  border: 1px solid var(--accent);
  color: var(--accent);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.8rem;
  margin-bottom: 8px;
  text-align: center;
}

/* During the start animation the letters are faint and not tappable. */
.grid.scrambling {
  pointer-events: none;
}

.grid.scrambling .glyph {
  opacity: 0.3;
}

.grid.scrambling .cross {
  opacity: 0.4;
}

.cell {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid var(--cell-border);
  border-radius: 8px;
  background: var(--cell);
  color: var(--text);
  font-size: clamp(1.4rem, 6.5vw, 2rem);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  touch-action: none;
}

.glyph {
  color: #fff;
}

/* Four tick marks at the tile-edge midpoints, pointing at the center.
   The center itself stays clear so the letter is never obscured. */
.cross {
  --tick: rgba(255, 183, 77, 0.6);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(var(--tick), var(--tick)) top center / 2px 7px no-repeat,
    linear-gradient(var(--tick), var(--tick)) bottom center / 2px 7px no-repeat,
    linear-gradient(var(--tick), var(--tick)) left center / 7px 2px no-repeat,
    linear-gradient(var(--tick), var(--tick)) right center / 7px 2px no-repeat;
}

/* ---- Results & tables ---- */
.device-line {
  margin-top: -6px;
  font-size: 0.8rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.actions .ghost {
  margin-top: 16px;
  padding: 14px 24px;
  font-size: 1rem;
  border-radius: 12px;
  color: var(--text);
}

.stat-cards {
  display: flex;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
}

.stat-card {
  flex: 1 1 140px;
  background: var(--panel);
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--accent);
}

.stat-label {
  color: var(--dim);
  font-size: 0.8rem;
  margin-top: 4px;
}

.stat-sub {
  font-size: 0.75rem;
  color: var(--dim);
  margin-top: 6px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  font-size: 0.85rem;
}

th,
td {
  padding: 6px 10px;
  text-align: center;
  border-bottom: 1px solid var(--cell-border);
  white-space: nowrap;
}

@media (max-width: 420px) {
  table {
    font-size: 0.75rem;
  }

  th,
  td {
    padding: 5px 6px;
  }
}

th {
  color: var(--dim);
  font-weight: 600;
}

.good {
  color: var(--good);
  font-weight: 700;
}

.bad {
  color: var(--bad);
  font-weight: 700;
}

.history {
  margin-top: 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
