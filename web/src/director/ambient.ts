import { isHauntedPhase } from '../core';
import { fx } from '../fx/fxStore';
import { dispatch, useStory } from '../store';
import { blackoutPattern, brownoutPattern } from './flash';
import { onStage, pageCenter, playLight, rand, reducedMotion, wait } from './runtime';

function story() {
  return useStory.getState().story;
}

function busyTyping(): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || window.location.pathname === '/checkout';
}

/** Day state: one rare, deniable sign at a time, ≤ 2 s, ≥ 30 s apart (Requirement 7). */
export async function dayLoop(signal: AbortSignal) {
  await wait(20000, signal);
  while (!signal.aborted && story().phase === 'day') {
    const kinds = ['bulb', 'tilt', 'shadow'] as const;
    const sign = kinds[Math.floor(rand() * kinds.length)] ?? 'bulb';
    fx().set({ sign });
    await wait(reducedMotion() ? 2000 : 1800, signal);
    fx().set({ sign: 'none' });
    await wait(30000 + rand() * 30000, signal);
  }
}

let handPlayed = false;

/** The severed hand: rises finger by finger, grips, pulls itself toward the grid (Req 11.3a–b). */
async function crawlingHand(signal: AbortSignal) {
  handPlayed = true;
  const grid = document.querySelector('[data-testid="product-grid"]');
  const vx = window.innerWidth * (0.2 + rand() * 0.5);
  let x = vx + window.scrollX;
  let y = window.scrollY + window.innerHeight - 30;
  const target = grid ? pageCenter(grid) : { x, y: y - 300 };
  const set = (stage: number) => {
    fx().set({ flags: { ...fx().flags, 'hand-x': x - window.scrollX, 'hand-y': y - window.scrollY, 'hand-stage': stage } });
  };
  const add = (kind: string, rot = 0) =>
    dispatch({ type: 'MARK_ADDED', mark: { id: `${kind}-${Date.now()}-${Math.round(rand() * 1e6)}`, kind, x, y, rotation: rot, scale: 1, product: null } });
  set(0);
  await wait(1600, signal);
  set(1);
  add('blood-print');
  await wait(900, signal);
  for (let i = 0; i < 3 && !signal.aborted; i++) {
    const dx = (target.x - x) * 0.2;
    const dy = Math.max(-140, (target.y - y) * 0.25);
    const ang = Math.atan2(dy, dx);
    set(2);
    await wait(500, signal);
    x += dx;
    y += dy;
    add('drag', ang);
    add('blood-print', ang);
    set(1);
    await wait(900, signal);
  }
  set(3);
  await wait(900, signal);
  const flags = { ...fx().flags };
  delete flags['hand-x'];
  delete flags['hand-y'];
  delete flags['hand-stage'];
  fx().set({ flags });
}

let sneaked = false;

/** Haunted state: Brownouts, Blackouts, the hand once, sneak-into-basket in Act 2 (Req 34, 37, 40). */
export async function hauntedLoop(signal: AbortSignal) {
  await wait(6000, signal);
  while (!signal.aborted && isHauntedPhase(story().phase)) {
    const act = story().act;
    const gap = Math.max(7000, 22000 - act * 4500) + rand() * 9000;
    await wait(gap, signal);
    if (signal.aborted || story().phase !== 'haunted' || busyTyping()) continue;
    const roll = rand();
    if (!handPlayed && act >= 1 && roll < 0.35 && !reducedMotion()) {
      await onStage('hand', 'major', false, crawlingHand);
    } else if (act >= 2 && !sneaked && roll < 0.55) {
      sneaked = true;
      const candidates = (['mittens', 'teddy-bear', 'glass-ornament', 'candle'] as const).filter((id) => !(id in story().cart));
      const pick = candidates[0];
      if (pick) dispatch({ type: 'SNEAK_INTO_CART', id: pick });
    } else if (act >= 2 && roll > 0.82) {
      await onStage('blackout', 'major', false, (s) => playLight(blackoutPattern(rand), s));
    } else {
      await onStage('brownout', 'major', false, (s) => playLight(brownoutPattern(rand(), rand), s));
    }
  }
}
