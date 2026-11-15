import gsap from 'gsap';
import { fx } from '../fx/fxStore';
import { markEnded } from '../fx/ended';
import { decayUniforms } from '../gl/decay';
import { glBus } from '../gl/bus';
import { dispatch, useStory, useUi } from '../store';
import { nav } from './bridge';
import { sendEcho } from './echo';
import { playLight, reducedMotion, wait } from './runtime';

function tweenDecay(to: number, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    glBus.revealing = true;
    gsap.to(decayUniforms.uDecay, {
      value: to,
      duration: seconds,
      ease: 'power2.inOut',
      onUpdate: () => glBus.invalidate(),
      onComplete: () => {
        glBus.revealing = false;
        glBus.invalidate();
        resolve();
      },
    });
  });
}

/** The catch, the lunge, the dark, the Reveal behind it (Requirements 9.6–9.10, 10). Under 4 s. */
export async function revealSequence(): Promise<void> {
  useUi.getState().setCartOpen(false);
  const set = fx().set;
  if (reducedMotion()) {
    set({ catchStep: 'grab' });
    await wait(350);
    set({ catchStep: 'dark' });
    decayUniforms.uDecay.value = 1;
    dispatch({ type: 'REVEAL_DONE' });
    await wait(700);
    set({ catchStep: 'none' });
  } else {
    set({ catchStep: 'grab' });
    await wait(420);
    set({ catchStep: 'turn' });
    await wait(480);
    set({ catchStep: 'lunge' });
    await wait(520);
    set({ catchStep: 'dark', mains: 0.2 });
    const decay = tweenDecay(1, 1.1);
    await wait(500);
    dispatch({ type: 'REVEAL_DONE' });
    await decay;
    set({ catchStep: 'release', mains: 1 });
    await wait(650);
    set({ catchStep: 'none' });
  }
  useUi.getState().announce('The lights have changed.');
}

let closingCtrl: AbortController | null = null;

export function skipClosing() {
  closingCtrl?.abort();
}

/** Closing time, the climax (Requirement 38). Skip jumps straight to the after state. */
export async function closingSequence(): Promise<void> {
  const ctrl = new AbortController();
  closingCtrl = ctrl;
  const s = ctrl.signal;
  const set = fx().set;
  const reduced = reducedMotion();
  try {
    set({ closingStep: 'power' });
    await playLight(
      [
        { t: 0, level: 0.85 },
        { t: 600, level: 0.65 },
        { t: 1400, level: 0.45 },
        { t: 2200, level: 0.3 },
        { t: 2700, level: 0 },
      ],
      s,
    );
    if (s.aborted) return;
    set({ closingStep: 'eyes', mains: 0 });
    await wait(reduced ? 1500 : 4000, s);
    if (s.aborted) return;
    set({ mains: 0.55 });
    await wait(250, s);
    set({ mains: 0.25 });
    await wait(300, s);
    set({ closingStep: 'sheets', mains: 0.75 });
    await wait(reduced ? 1500 : 3500, s);
    if (s.aborted) return;
    set({ closingStep: 'turn' });
    await wait(reduced ? 1500 : 5000, s);
    if (s.aborted) return;
    set({ closingStep: 'ghost', mains: 0.5 });
    await wait(reduced ? 1500 : 4500, s);
    if (s.aborted) return;
    set({ mains: 0 });
    await wait(1200, s);
  } finally {
    set({ closingStep: 'after', mains: 1 });
    dispatch({ type: 'CLOSING_DONE' });
    await wait(ctrl.signal.aborted ? 300 : 2200);
    set({ closingStep: 'none' });
    closingCtrl = null;
  }
}

/** Accept: one tremor, the room goes quiet, the message, then the opening shop (Req 22.7, 23). */
export async function acceptedSequence(): Promise<void> {
  const set = fx().set;
  const root = document.documentElement;
  if (!reducedMotion()) {
    root.classList.add('tremor');
    await wait(520);
    root.classList.remove('tremor');
  } else {
    set({ mains: 0.6 });
    await wait(400);
    set({ mains: 1 });
  }
  set({ quiet: true, acceptedShown: true, cartRinging: false });
  await wait(4000);
  const left = useStory.getState().story.leftBehind;
  markEnded();
  if (left) void sendEcho(left);
  decayUniforms.uDecay.value = 0;
  dispatch({ type: 'RETURN_DONE' });
  set({ quiet: false, acceptedShown: false, flyPerch: null, prints: [], batPerch: 'hero-echo', flags: {} });
  glBus.invalidate();
  nav.go('/');
  window.scrollTo({ top: 0 });
}
