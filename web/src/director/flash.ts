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

/**
 * A Brownout: sag over about half a second with small noise, a short hold, uneven recovery
 * (Req 34.2). Never very dark, never long: a dip the visitor can keep shopping through.
 */
export function brownoutPattern(depth: number, rand: () => number): LightKey[] {
  const low = 0.55 + Math.min(0.15, Math.max(0, depth) * 0.35);
  const keys: LightKey[] = [];
  for (let i = 1; i <= 6; i++) keys.push({ t: i * 80, level: 1 - (1 - low) * (i / 6) + (rand() - 0.5) * 0.05 });
  const hold = 400 + rand() * 500;
  keys.push({ t: 480 + hold, level: low + 0.1 });
  keys.push({ t: 640 + hold, level: low + 0.04 });
  keys.push({ t: 860 + hold, level: 0.85 });
  keys.push({ t: 1060 + hold, level: 1 });
  return limitFlashes(keys);
}

/** A Blackout of about a second, not quite black, then the light returns in steps (Req 34.3). */
export function blackoutPattern(rand: () => number): LightKey[] {
  const dark = 700 + rand() * 600;
  return limitFlashes([
    { t: 0, level: 0.7 },
    { t: 120, level: 0.3 },
    { t: dark, level: 0.5 },
    { t: dark + 350, level: 0.4 },
    { t: dark + 650, level: 0.75 },
    { t: dark + 1000, level: 1 },
  ]);
}

/** Coming back to the tab: two short dips and the light is steady again (no long dark). */
export function returnPattern(): LightKey[] {
  return limitFlashes([
    { t: 0, level: 0.6 },
    { t: 220, level: 1 },
    { t: 1050, level: 0.6 },
    { t: 1270, level: 1 },
  ]);
}
