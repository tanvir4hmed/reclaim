import { useEffect, useRef } from 'react';
import type { ProductId } from '../core/ids';
import { reducedMotion } from '../director/runtime';
import { useHaunted, useStory } from '../store';

/**
 * For a product's Take event (the instant thing that happens to the object when you take it
 * after the Reveal). Returns whether it has happened and a function giving the seconds since:
 * Infinity when it happened before this view mounted (reload: show the end state), or under
 * reduced motion (jump to the end state, the meaning without the motion).
 */
export function useTaken(id: ProductId): { taken: boolean; since: () => number } {
  const haunted = useHaunted();
  const played = useStory((s) => s.story.played[id] === true);
  const taken = haunted && played;
  const at = useRef<number | null>(taken ? -Infinity : null);
  useEffect(() => {
    if (taken && at.current === null) at.current = performance.now();
    if (!taken) at.current = null;
  }, [taken]);
  const since = () => {
    const t = at.current;
    if (t === null) return taken ? 0 : -1;
    if (t === -Infinity || reducedMotion()) return Infinity;
    return (performance.now() - t) / 1000;
  };
  return { taken, since };
}

/** 0→1 over `dur` seconds after `delay`, eased; 1 for Infinity. */
export function progress(s: number, dur: number, delay = 0): number {
  if (s === Infinity) return 1;
  const k = Math.min(1, Math.max(0, (s - delay) / dur));
  return k * k * (3 - 2 * k);
}
