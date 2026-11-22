import gsap from 'gsap';
import { fx } from '../fx/fxStore';
import { markEnded } from '../fx/ended';
import { decayUniforms } from '../gl/decay';
import { glBus } from '../gl/bus';
import { dispatch, useStory, useUi } from '../store';
import { nav } from './bridge';
import { sendEcho } from './echo';
import { playLight, reducedMotion, wait } from './runtime';

/** Length of the lunge from the bat's size to full screen (kept in step with CatchLunge). */
export const LUNGE_MS = 1350;

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
    // The bony fist closes on the bat, its head jerks round to face the screen, then it flies
    // straight at the visitor, growing smoothly from its own size until its wings blot out
    // the whole screen. The Reveal happens in that dark.
    set({ catchStep: 'grab' });
    await wait(420);
    set({ catchStep: 'turn' });
    await wait(520);
    set({ catchStep: 'lunge' });
    await wait(LUNGE_MS);
    set({ catchStep: 'dark', mains: 0.2 });
    const decay = tweenDecay(1, 0.9);
    // Long enough in the black to see the two claw marks it left on the screen.
    await wait(650);
    dispatch({ type: 'REVEAL_DONE' });
    await decay;
    set({ catchStep: 'release', mains: 1 });
    await wait(550);
    set({ catchStep: 'none', catchFrom: null, catchHand: null });
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
        { t: 0, level: 0.7 },
        { t: 350, level: 0.4 },
        { t: 800, level: 0.12 },
      ],
      s,
    );
    if (s.aborted) return;
    // The sheet ghost rises out of the dark, close and silent, and lifts its hem.
    set({ closingStep: 'ghost', mains: 0.35 });
    await wait(reduced ? 1400 : 2800, s);
    if (s.aborted) return;
    set({ mains: 0 });
    await wait(600, s);
  } finally {
    set({ closingStep: 'after', mains: 1 });
    dispatch({ type: 'CLOSING_DONE' });
    await wait(ctrl.signal.aborted ? 300 : 1400);
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
  // The one jump scare in the game, and it is earned: the shop's last resident comes for the
  // visitor who just "bought" her things. Reduced motion shows her still, then a fade.
  set({ scare: true });
  await wait(reducedMotion() ? 1100 : 1250);
  set({ scare: false });
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
