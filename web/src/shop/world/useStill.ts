import { useSyncExternalStore } from 'react';
import { reducedMotion } from '../../director/runtime';
import { useStory } from '../../store';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const m = typeof window !== 'undefined' ? window.matchMedia?.(QUERY) : undefined;
  m?.addEventListener('change', onChange);
  return () => m?.removeEventListener('change', onChange);
}

const systemReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;

/**
 * True when the painted world's figures should hold a still pose: the visitor chose reduced
 * motion in the footer, or the system asks for it. Re-renders when either one changes.
 */
export function useStill(): boolean {
  useStory((s) => s.story.settings.motion);
  const system = useSyncExternalStore(subscribe, systemReduced, () => false);
  return system || reducedMotion();
}
