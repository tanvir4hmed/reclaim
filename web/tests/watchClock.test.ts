import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/director/runtime', () => ({ reducedMotion: () => false }));

const { markWatchTaken, watchSeconds, WHIRL_MS } = await import('../src/products/pocket-watch/watchClock');

const at = (h: number, m: number, s = 0) => new Date(2026, 11, 24, h, m, s).getTime();
const hms = (v: number) => {
  const x = ((Math.round(v) % 43200) + 43200) % 43200;
  return `${Math.floor(x / 3600)}:${String(Math.floor((x % 3600) / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

describe('the pocket watch clock', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the visitor’s own time, ticking forward, until it is taken', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(19, 33, 20));
    expect(hms(watchSeconds(false))).toBe('7:33:20');
    vi.setSystemTime(at(19, 33, 21));
    expect(hms(watchSeconds(false))).toBe('7:33:21');
  });

  it('once taken, whips back to ten to three and then runs backward', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(19, 33, 20));
    markWatchTaken();
    // during the whirl it is somewhere between the time it was taken and 2:50, going back
    vi.setSystemTime(at(19, 33, 20) + WHIRL_MS / 2);
    // read on the 12-hour dial, as the hands show it
    const mid = watchSeconds(true) % 43200;
    expect(mid).toBeLessThan(7 * 3600 + 33 * 60 + 20);
    expect(mid).toBeGreaterThan(2 * 3600 + 50 * 60);
    vi.setSystemTime(at(19, 33, 20) + WHIRL_MS);
    expect(hms(watchSeconds(true))).toBe('2:50:00');
    vi.setSystemTime(at(19, 33, 20) + WHIRL_MS + 5000);
    expect(hms(watchSeconds(true))).toBe('2:49:55');
    vi.setSystemTime(at(19, 33, 20) + WHIRL_MS + 65_000);
    expect(hms(watchSeconds(true))).toBe('2:48:55');
  });
});
