import { describe, expect, it } from 'vitest';
import { initialState, load, reduce, save, type StoryState } from '../../src/core';

/** Regression for a failure the persistence property found once (seed -757193386). */
describe('persistence regression', () => {
  it('a mark with rotation -0 survives save and load', () => {
    let s: StoryState = initialState();
    s = reduce(s, { type: 'BAT_CAUGHT' });
    s = reduce(s, { type: 'REVEAL_DONE' });
    s = reduce(s, {
      type: 'MARK_ADDED',
      mark: { id: 'a', kind: 'footprint', x: 10, y: 20, rotation: -0, scale: 1, product: null },
    });
    const data = new Map<string, string>();
    save({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, s);
    const loaded = load({ getItem: (k) => data.get(k) ?? null, setItem: () => {} });
    expect(loaded).toEqual(s);
  });

  it('rejects marks with non-finite coordinates', () => {
    let s: StoryState = reduce(reduce(initialState(), { type: 'BAT_CAUGHT' }), { type: 'REVEAL_DONE' });
    s = reduce(s, {
      type: 'MARK_ADDED',
      mark: { id: 'b', kind: 'ash', x: Number.NaN, y: 0, rotation: 0, scale: 1, product: null },
    });
    expect(s.marks).toEqual([]);
  });
});
