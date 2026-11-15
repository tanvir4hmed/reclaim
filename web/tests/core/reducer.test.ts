import { describe, expect, it } from 'vitest';
import { initialState, step, type StoryEvent, type StoryState } from '../../src/core';

function run(events: StoryEvent[], start: StoryState = initialState()) {
  let state = start;
  const cues = [];
  for (const e of events) {
    const r = step(state, e);
    state = r.state;
    cues.push(...r.cues);
  }
  return { state, cues };
}

describe('story walk-through', () => {
  it('plays a full run from the Day shop to the echo', () => {
    const { state, cues } = run([
      { type: 'ADD_TO_CART', id: 'letter' },
      { type: 'BAT_CAUGHT' },
      { type: 'REVEAL_DONE' },
      { type: 'ADD_TO_CART', id: 'shoes' },
      { type: 'ADD_TO_CART', id: 'pocket-watch' },
      { type: 'SET_QTY', id: 'letter', qty: 2 },
      { type: 'OPEN_CHECKOUT' },
      { type: 'CLOSING_DONE' },
      { type: 'SET_PAYMENT', payment: { kind: 'memory', option: 'your-first-snow' } },
      { type: 'SET_AGREEMENT', agreed: true },
      { type: 'ACCEPT' },
    ]);

    expect(state.phase).toBe('accepted');
    expect(state.act).toBe(4);
    expect(state.clockDirection).toBe(-1);
    // The letter was carted in the Day state; its consequence plays when incremented after the Reveal (Req 12.5).
    expect(cues.filter((c) => c.type === 'consequence').map((c) => (c.type === 'consequence' ? c.id : ''))).toEqual([
      'shoes',
      'pocket-watch',
      'letter',
    ]);
    expect(cues.some((c) => c.type === 'closing')).toBe(true);
    // Most recently carted Featured product is left behind (Req 23.2).
    expect(state.leftBehind).toEqual({ product: 'letter', condition: 'taken' });

    const back = step(state, { type: 'RETURN_DONE' }).state;
    expect(back.phase).toBe('day');
    expect(back.cart).toEqual({});
    expect(back.echo).toEqual({ product: 'letter', condition: 'taken' });
  });

  it('does not let the Day checkout complete', () => {
    const { state } = run([
      { type: 'ADD_TO_CART', id: 'cake' },
      { type: 'OPEN_CHECKOUT' },
      { type: 'SET_AGREEMENT', agreed: true },
      { type: 'ACCEPT' },
    ]);
    expect(state.phase).toBe('day');
  });

  it('keeps taken items counted after removal', () => {
    const { state } = run([
      { type: 'BAT_CAUGHT' },
      { type: 'REVEAL_DONE' },
      { type: 'ADD_TO_CART', id: 'doll' },
      { type: 'ADD_TO_CART', id: 'mirror' },
      { type: 'REMOVE', id: 'doll' },
    ]);
    expect(state.taken).toEqual(['doll', 'mirror']);
    expect(state.act).toBe(2);
    expect(state.cart).toEqual({ mirror: 1 });
  });

  it('plays closing time only once, then goes straight to checkout', () => {
    const { state, cues } = run([
      { type: 'BAT_CAUGHT' },
      { type: 'REVEAL_DONE' },
      { type: 'ADD_TO_CART', id: 'cake' },
      { type: 'OPEN_CHECKOUT' },
      { type: 'CLOSING_DONE' },
      { type: 'DECLINE' },
      { type: 'OPEN_CHECKOUT' },
    ]);
    expect(cues.filter((c) => c.type === 'closing')).toHaveLength(1);
    expect(state.phase).toBe('checkout');
    expect(state.act).toBe(3);
  });
});
