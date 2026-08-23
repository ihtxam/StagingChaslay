/**
 * Browser ringtone for incoming online shop orders (Web Audio API — no asset file).
 */

let sharedCtx: AudioContext | null = null;
let loopTimer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) sharedCtx = new AC();
    if (sharedCtx.state === 'suspended') void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, start: number, dur: number, gain = 0.18) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** One alert sequence (~1.4s): ascending chime. */
export function playOrderAlertOnce(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  tone(ctx, 880, t0, 0.18, 0.2);
  tone(ctx, 1175, t0 + 0.2, 0.18, 0.2);
  tone(ctx, 1480, t0 + 0.4, 0.28, 0.22);
  tone(ctx, 1175, t0 + 0.75, 0.15, 0.14);
  tone(ctx, 1480, t0 + 0.95, 0.35, 0.2);
}

/** Short double ding when a waiter/mobile order reaches the main till (~0.5s). */
export function playWaiterTillBellOnce(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  tone(ctx, 988, t0, 0.12, 0.16);
  tone(ctx, 1319, t0 + 0.16, 0.22, 0.18);
}

/** Triple chime when a new reservation prints at the main till (~0.9s). */
export function playReservationTillBellOnce(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  tone(ctx, 740, t0, 0.14, 0.17);
  tone(ctx, 988, t0 + 0.18, 0.14, 0.17);
  tone(ctx, 1175, t0 + 0.36, 0.28, 0.19);
  tone(ctx, 988, t0 + 0.68, 0.12, 0.14);
}

/** Repeat ringtone until stopOrderAlertLoop() — used while new orders are waiting. */
export function startOrderAlertLoop(intervalMs = 4500): void {
  if (loopTimer) return;
  playOrderAlertOnce();
  loopTimer = setInterval(() => playOrderAlertOnce(), intervalMs);
}

export function stopOrderAlertLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function isOrderAlertLooping(): boolean {
  return loopTimer != null;
}

let durationTimer: ReturnType<typeof setTimeout> | null = null;

/** Ring for a fixed duration (default 10s), then stop automatically. */
export function startOrderAlertForDuration(totalMs = 10000, intervalMs = 2500): void {
  stopOrderAlertLoop();
  startOrderAlertLoop(intervalMs);
  durationTimer = setTimeout(() => {
    stopOrderAlertLoop();
    durationTimer = null;
  }, totalMs);
}

export function stopOrderAlertForDuration(): void {
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
  stopOrderAlertLoop();
}
