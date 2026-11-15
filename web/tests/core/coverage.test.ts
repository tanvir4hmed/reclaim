import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { initialState, step, type StoryState } from '../../src/core';
import { events } from './arbitraries';

/**
 * Guards against vacuous property tests: the event generator must actually
 * reach the interesting parts of the story often enough.
 */
describe('generator coverage', () => {
  it('reaches haunted, checkout, accepted and the return in a fair share of runs', () => {
    const samples = fc.sample(events, { numRuns: 1000, seed: 42 });
    const reached = { haunted: 0, checkout: 0, accepted: 0, returned: 0, consequence: 0 };
    for (const seq of samples) {
      let s: StoryState = initialState();
      const seen = new Set<string>();
      for (const ev of seq) {
        const r = step(s, ev);
        if (r.state.phase === 'haunted') seen.add('haunted');
        if (r.state.phase === 'checkout') seen.add('checkout');
        if (r.state.phase === 'accepted') seen.add('accepted');
        if (r.cues.some((c) => c.type === 'returned')) seen.add('returned');
        if (r.cues.some((c) => c.type === 'consequence')) seen.add('consequence');
        s = r.state;
      }
      for (const k of seen) reached[k as keyof typeof reached] += 1;
    }
    expect(reached.haunted).toBeGreaterThan(500);
    expect(reached.consequence).toBeGreaterThan(300);
    expect(reached.checkout).toBeGreaterThan(100);
    expect(reached.accepted).toBeGreaterThan(20);
    expect(reached.returned).toBeGreaterThan(10);
  });
});
