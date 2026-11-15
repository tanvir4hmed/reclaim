import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_QTY,
  initialState,
  isValidPayment,
  step,
  weightOf,
  type ProductId,
  type StoryState,
} from '../../src/core';
import { events } from './arbitraries';

const RUNS = { numRuns: 400 };

/** Runs a sequence and calls `check(before, event, after, cues)` on every transition. */
function walk(
  seq: Parameters<typeof step>[1][],
  check: (before: StoryState, ev: Parameters<typeof step>[1], after: StoryState, cues: ReturnType<typeof step>['cues']) => void,
  start: StoryState = initialState(),
): StoryState {
  let s = start;
  for (const ev of seq) {
    const r = step(s, ev);
    check(s, ev, r.state, r.cues);
    s = r.state;
  }
  return s;
}

describe('state core properties', () => {
  it('the Reveal never changes the cart (Req 6.4, 10.2)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        walk(seq, (before, ev, after) => {
          if (ev.type === 'BAT_CAUGHT' || ev.type === 'REVEAL_DONE') {
            expect(after.cart).toEqual(before.cart);
          }
        });
      }),
      RUNS,
    );
  });

  it('without BAT_CAUGHT the shop never leaves the Day state (Req 8.6)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        const noCatch = seq.filter((e) => e.type !== 'BAT_CAUGHT');
        walk(noCatch, (_b, _e, after) => expect(after.phase).toBe('day'));
      }),
      RUNS,
    );
  });

  it('Weight and act never decrease until the ending resets the run (Req 37.4)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        walk(seq, (before, ev, after) => {
          if (ev.type === 'RETURN_DONE' && after.phase === 'day') return;
          expect(weightOf(after)).toBeGreaterThanOrEqual(weightOf(before));
          expect(after.act).toBeGreaterThanOrEqual(before.act);
        });
      }),
      RUNS,
    );
  });

  it('a Consequence is cued in full at most once per run (Req 12.4)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        let seen = new Set<ProductId>();
        walk(seq, (_b, ev, after, cues) => {
          for (const c of cues) {
            if (c.type === 'consequence') {
              expect(seen.has(c.id)).toBe(false);
              seen.add(c.id);
            }
          }
          if (ev.type === 'RETURN_DONE' && after.phase === 'day') seen = new Set();
        });
      }),
      RUNS,
    );
  });

  it('the order is accepted only with agreement and a valid payment (Req 22.3, 22.4)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        walk(seq, (before, _ev, after) => {
          if (before.phase !== 'accepted' && after.phase === 'accepted') {
            expect(before.checkout.agreed).toBe(true);
            expect(isValidPayment(before.checkout.payment)).toBe(true);
            expect(Object.keys(before.cart).length).toBeGreaterThan(0);
          }
        });
      }),
      RUNS,
    );
  });

  it('the ending returns the exact opening state except echo and settings (Req 23.1)', () => {
    fc.assert(
      fc.property(events, (seq) => {
        walk(seq, (before, ev, after) => {
          if (ev.type === 'RETURN_DONE' && before.phase === 'accepted') {
            expect(after).toEqual(initialState(before.leftBehind ?? before.echo, before.settings));
          }
        });
      }),
      RUNS,
    );
  });

  it('quantities stay whole numbers between 1 and the maximum', () => {
    fc.assert(
      fc.property(events, (seq) => {
        const end = walk(seq, () => {});
        for (const q of Object.values(end.cart)) {
          expect(Number.isInteger(q)).toBe(true);
          expect(q).toBeGreaterThanOrEqual(1);
          expect(q).toBeLessThanOrEqual(MAX_QTY);
        }
      }),
      RUNS,
    );
  });

  it('only events from the Haunted state add to Weight', () => {
    fc.assert(
      fc.property(events, (seq) => {
        walk(seq, (before, _ev, after) => {
          if (before.phase === 'day' && after.phase === 'day') {
            expect(weightOf(after)).toBe(0);
          }
        });
      }),
      RUNS,
    );
  });
});
