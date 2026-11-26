import { reducedMotion } from '../../director/runtime';

/** Ten to three in the night: where it goes back to the moment it is taken, and runs back from. */
const BACK_FROM = 2 * 3600 + 50 * 60;
/** How long the hands take to whip back to 2:50. */
export const WHIRL_MS = 1600;
const TWELVE_H = 12 * 3600;
const KEY = 'reclaim:watch-taken';

let memo: number | null = null;

/** Remember when the watch was taken (wall clock), so every view, and a reload, agree. */
export function markWatchTaken(): void {
  memo = Date.now();
  try {
    localStorage.setItem(KEY, String(memo));
  } catch {
    /* storage blocked: the views on this page still agree */
  }
}

function takenAt(): number | null {
  if (memo !== null) return memo;
  try {
    const v = Number(localStorage.getItem(KEY));
    memo = Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    memo = null;
  }
  return memo;
}

function wallSeconds(d: Date): number {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}

/**
 * The one time every copy of the watch shows (card and full view): a function of the wall
 * clock only, so they can never disagree. Until it is taken, by day and after the Reveal alike,
 * it keeps the visitor's own time, ticking forward. Taken, the hands whip back to ten to three,
 * and from then on it runs backward, the hands sweeping smoothly, for good (Req 14.2–14.3).
 */
export function watchSeconds(taken: boolean): number {
  const now = Date.now();
  if (!taken) return Math.floor(wallSeconds(new Date(now)));
  const at = takenAt() ?? now - WHIRL_MS;
  const dt = now - at;
  if (dt >= 0 && dt < WHIRL_MS && !reducedMotion()) {
    const start = wallSeconds(new Date(at));
    const back = (((start - BACK_FROM) % TWELVE_H) + TWELVE_H) % TWELVE_H;
    const k = dt / WHIRL_MS;
    return start - back * (1 - (1 - k) ** 3);
  }
  // backward with a smooth sweep, not a tick a second
  return BACK_FROM - Math.max(0, dt - WHIRL_MS) / 1000;
}
