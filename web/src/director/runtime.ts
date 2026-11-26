import { fx } from '../fx/fxStore';
import { glBus } from '../gl/bus';
import { useStory } from '../store';
import { limitFlashes, type LightKey } from './flash';
import { begin, canStart, end, initialStage, type AnomalySize, type StageState } from './stage';

/** `?director` speeds timers up for demo recording; it never starts the Reveal (Req 33.2). */
export const directorMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('director');
export const timeScale = directorMode ? 3 : 1;

export function reducedMotion(): boolean {
  const pref = useStory.getState().story.settings.motion;
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A wait that pauses while the tab is hidden (Requirement 27.4) and honours the time scale. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let left = ms / timeScale;
    let last = performance.now();
    let id = 0;
    const tick = () => {
      if (signal?.aborted) return resolve();
      const now = performance.now();
      if (!document.hidden) left -= now - last;
      last = now;
      if (left <= 0) return resolve();
      id = window.setTimeout(tick, Math.min(250, Math.max(16, left)));
    };
    id = window.setTimeout(tick, Math.min(250, Math.max(0, left)));
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    });
  });
}

export function rand(): number {
  return Math.random();
}

/** Plays a light pattern on `mains`, always through the flash limiter. */
export async function playLight(pattern: LightKey[], signal?: AbortSignal): Promise<void> {
  const safe = limitFlashes(pattern, fx().mains);
  if (reducedMotion()) {
    // A single soft dim and return instead of flicker (Req 9.6, 34.7).
    const low = Math.max(0.55, Math.min(...safe.map((k) => k.level), 1));
    fx().set({ mains: low });
    glBus.invalidate();
    await wait(600, signal);
    fx().set({ mains: 1 });
    glBus.invalidate();
    return;
  }
  let t0 = 0;
  for (const k of safe) {
    await wait(k.t - t0, signal);
    t0 = k.t;
    if (signal?.aborted) break;
    fx().set({ mains: k.level });
    glBus.invalidate();
  }
}

let stage: StageState = initialStage;

/**
 * Runs an Anomaly under the Stage rule (Requirement 12.3a/3b). Visitor Consequences pre-empt
 * ambient ones (their abort signal fires). Returns false if it may not start now.
 */
let ambientAbort: AbortController | null = null;

export async function onStage(
  id: string,
  size: AnomalySize,
  visitor: boolean,
  run: (signal: AbortSignal) => Promise<void>,
): Promise<boolean> {
  const act = useStory.getState().story.act;
  if (!canStart(stage, size, visitor, performance.now(), act)) return false;
  if (visitor && stage.holder) {
    ambientAbort?.abort();
    stage = end(stage, stage.holder.id, performance.now());
  }
  const ctrl = new AbortController();
  if (!visitor) ambientAbort = ctrl;
  stage = begin(stage, id, size, visitor);
  try {
    await run(ctrl.signal);
  } finally {
    stage = end(stage, id, performance.now());
    if (ambientAbort === ctrl) ambientAbort = null;
  }
  return true;
}

/** Stops an ambient light pattern in progress and puts the light back on (tab hidden). */
export function calmAmbient(): void {
  ambientAbort?.abort();
  fx().set({ mains: 1 });
  glBus.invalidate();
}

export function stageBusy(): boolean {
  return stage.holder !== null;
}

/** Page-coordinate centre of an element (for decals that stay where they fell, Req 11.3b). */
export function pageCenter(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
}
