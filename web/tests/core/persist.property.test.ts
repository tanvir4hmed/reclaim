import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  initialState,
  load,
  reduce,
  sanitize,
  save,
  type KeyValueStore,
  type StoryState,
} from '../../src/core';
import { events } from './arbitraries';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const RUNS = { numRuns: 300 };

describe('persistence properties (Req 6.3, 10.5)', () => {
  it('any reachable state survives save and load', () => {
    fc.assert(
      fc.property(events, (seq) => {
        const state = seq.reduce<StoryState>(reduce, initialState());
        const store = memoryStore();
        save(store, state);
        const loaded = load(store);
        if (state.phase === 'catching') {
          expect(loaded).toEqual({ ...state, phase: 'haunted' });
        } else if (state.phase === 'closing') {
          expect(loaded).toEqual({ ...state, phase: 'checkout', closingPlayed: true });
        } else {
          expect(loaded).toEqual(state);
        }
      }),
      RUNS,
    );
  });

  it('sanitize never throws and never returns out-of-range data for arbitrary JSON', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (raw) => {
        const s = sanitize(raw);
        if (s === null) return;
        for (const q of Object.values(s.cart)) expect(q).toBeGreaterThan(0);
        expect([1, -1]).toContain(s.clockDirection);
      }),
      { numRuns: 500 },
    );
  });

  it('corrupt or foreign storage starts a fresh run', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const store = memoryStore();
        store.setItem(STORAGE_KEY, text);
        const loaded = load(store);
        expect(loaded.version).toBe(1);
      }),
      RUNS,
    );
  });
});
