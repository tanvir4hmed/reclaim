/** A light keyframe: at time `t` (ms from start) the electric light goes to `level` (0..1). */
export interface LightKey {
  t: number;
  level: number;
}

/** A change of more than this much brightness counts as one flash (WCAG 2.3.1 general flash). */
export const FLASH_DELTA = 0.2;
export const MAX_FLASHES_PER_SECOND = 3;

/**
 * Makes any light pattern safe: drops keyframes that would create a fourth flash inside any
 * one-second window (Requirements 9.4, 26.5, 34). Input order is by time; output keeps order.
 */
export function limitFlashes(pattern: readonly LightKey[], start = 1): LightKey[] {
  const keys = [...pattern].filter((k) => Number.isFinite(k.t) && Number.isFinite(k.level)).sort((a, b) => a.t - b.t);
  const out: LightKey[] = [];
  const flashes: number[] = [];
  let level = start;
  for (const k of keys) {
    const next = Math.min(1, Math.max(0, k.level));
    if (Math.abs(next - level) > FLASH_DELTA) {
      while (flashes.length && (flashes[0] as number) <= k.t - 1000) flashes.shift();
      if (flashes.length >= MAX_FLASHES_PER_SECOND) continue;
      flashes.push(k.t);
    }
    level = next;
    out.push({ t: k.t, level: next });
  }
  return out;
}

/** Counts flashes in the worst one-second window, for tests. */
export function maxFlashesInAnySecond(pattern: readonly LightKey[], start = 1): number {
  const times: number[] = [];
  let level = start;
  for (const k of [...pattern].sort((a, b) => a.t - b.t)) {
    if (Math.abs(k.level - level) > FLASH_DELTA) times.push(k.t);
    level = k.level;
  }
  let worst = 0;
  for (let i = 0; i < times.length; i++) {
    let n = 0;
    for (let j = i; j < times.length && (times[j] as number) < (times[i] as number) + 1000; j++) n++;
    worst = Math.max(worst, n);
  }
  return worst;
}

/** The Storm flicker on hovering the Day bat: lightning dips, then a dark instant (Req 9.1). */
export function stormPattern(): LightKey[] {
  return limitFlashes([
    { t: 0, level: 0.35 },
    { t: 70, level: 1 },
    { t: 160, level: 0.15 },
    { t: 260, level: 0.9 },
    { t: 420, level: 0.05 },
    { t: 520, level: 1 },
    { t: 700, level: 0.4 },
    { t: 1100, level: 1 },
  ]);
}

/** A Brownout: sag over about a second with small noise, hold, uneven recovery (Req 34.2). */
export function brownoutPattern(depth: number, rand: () => number): LightKey[] {
  const low = 0.3 + Math.min(0.4, Math.max(0, depth)) ;
  const keys: LightKey[] = [];
  for (let i = 1; i <= 8; i++) keys.push({ t: i * 120, level: 1 - (1 - low) * (i / 8) + (rand() - 0.5) * 0.06 });
  const hold = 900 + rand() * 900;
  keys.push({ t: 960 + hold, level: low + 0.15 });
  keys.push({ t: 1200 + hold, level: low + 0.05 });
  keys.push({ t: 1500 + hold, level: 0.8 });
  keys.push({ t: 1800 + hold, level: 1 });
  return limitFlashes(keys);
}

/** A Blackout of up to 3 s, then the light returns in two or three steps (Req 34.3). */
export function blackoutPattern(rand: () => number): LightKey[] {
  const dark = 1200 + rand() * 1700;
  return limitFlashes([
    { t: 0, level: 0.6 },
    { t: 120, level: 0 },
    { t: dark, level: 0.25 },
    { t: dark + 500, level: 0.1 },
    { t: dark + 900, level: 0.6 },
    { t: dark + 1500, level: 1 },
  ]);
}
